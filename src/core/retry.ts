/**
 * Retry with exponential backoff + jitter.
 * Only retries on 429, 5xx and network errors; never on 4xx (401, 402, etc.).
 *
 * Jitter prevents thundering herd when many clients retry simultaneously.
 * Respects Retry-After metadata from 429 responses.
 */

import type { RetryConfig } from './config';
import { DEFAULT_RETRY } from './config';
import type { AIGatewayError } from './errors';

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

function isRetryableStatus(status: number, retryableStatuses: number[]): boolean {
  return retryableStatuses.includes(status);
}

/** Add random jitter: 0-25% of the base delay to avoid thundering herd */
function addJitter(delayMs: number): number {
  const jitter = delayMs * 0.25 * Math.random();
  return delayMs + jitter;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retryConfig: RetryConfig;
    signal?: AbortSignal;
    isNetworkError?: (err: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => void | Promise<void>;
  }
): Promise<T> {
  const { maxAttempts, initialDelayMs, maxDelayMs, retryableStatuses } = {
    ...DEFAULT_RETRY,
    ...options.retryConfig,
  };
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      const status = (err as { statusCode?: number })?.statusCode;
      const isRetryable =
        status != null
          ? isRetryableStatus(status, retryableStatuses)
          : options.isNetworkError?.(err) ?? false;
      if (!isRetryable) throw err;

      const retryAfterSeconds = (err as AIGatewayError)?.retryAfter;
      let backoff: number;
      if (retryAfterSeconds != null && retryAfterSeconds > 0) {
        // Server-specified delay — use exactly, no jitter (contract compliance).
        backoff = retryAfterSeconds * 1000;
      } else {
        backoff = addJitter(Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs));
      }

      await options.onRetry?.(attempt, err);
      await delay(backoff, options.signal);
    }
  }
  throw lastError;
}
