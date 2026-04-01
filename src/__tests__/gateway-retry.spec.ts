/**
 * Unit tests for gateway-retry.ts and related normalizeRetryConfig.
 *
 * Covers:
 *   H-1: withRetry exhaustion (all maxAttempts fail on retryable status)
 *   H-3: delay() abort — signal already aborted / signal fires during delay
 *   M-7: retry: false skips withRetry (maxAttempts: 1 equivalent)
 *   normalizeRetryConfig coercion (0, negative, NaN, Infinity, float)
 */

import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../gateway-retry';
import { normalizeRetryConfig, DEFAULT_RETRY } from '../gateway-config';

// Tiny delay config used throughout — 1ms avoids any real-time slowdown.
const FAST: Required<import('../gateway-config').RetryConfig> = {
  maxAttempts: 3,
  initialDelayMs: 1,
  maxDelayMs: 1,
  retryableStatuses: [503, 429],
};

// ─── withRetry — success and basic retry ─────────────────────────────────────

describe('withRetry — basic behaviour', () => {
  it('returns result immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('value');
    const result = await withRetry(fn, { retryConfig: FAST });
    expect(result).toBe('value');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable status and succeeds', async () => {
    let attempt = 0;
    const fn = vi.fn().mockImplementation(() => {
      if (++attempt < 2) return Promise.reject({ statusCode: 503 });
      return Promise.resolve('ok');
    });
    expect(await withRetry(fn, { retryConfig: FAST })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on non-retryable status', async () => {
    const fn = vi.fn().mockRejectedValue({ statusCode: 400 });
    await expect(withRetry(fn, { retryConfig: FAST })).rejects.toMatchObject({ statusCode: 400 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on non-retryable error without isNetworkError callback', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('not a network error'));
    await expect(withRetry(fn, { retryConfig: FAST })).rejects.toBeInstanceOf(TypeError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries when isNetworkError returns true for errors without statusCode', async () => {
    let attempt = 0;
    const fn = vi.fn().mockImplementation(() => {
      if (++attempt < 3) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve('recovered');
    });
    expect(
      await withRetry(fn, {
        retryConfig: FAST,
        isNetworkError: (e) => e instanceof TypeError,
      }),
    ).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ─── H-1: exhaustion — all attempts fail ─────────────────────────────────────

describe('withRetry — attempt exhaustion (H-1)', () => {
  it('exhausts all maxAttempts and throws the last error (retryable status)', async () => {
    const fn = vi.fn().mockRejectedValue({ statusCode: 503, message: 'Still unavailable' });
    await expect(withRetry(fn, { retryConfig: FAST })).rejects.toMatchObject({
      statusCode: 503,
      message: 'Still unavailable',
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('exhausts maxAttempts=1 and throws without any retry', async () => {
    const fn = vi.fn().mockRejectedValue({ statusCode: 503 });
    await expect(withRetry(fn, { retryConfig: { ...FAST, maxAttempts: 1 } })).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts all attempts when isNetworkError errors never recover', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(withRetry(fn, { retryConfig: FAST, isNetworkError: () => true })).rejects.toBeInstanceOf(TypeError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws immediately on non-retryable error even with attempts remaining', async () => {
    const fn = vi.fn().mockRejectedValueOnce({ statusCode: 401 }).mockResolvedValue('should-not-reach');
    await expect(withRetry(fn, { retryConfig: FAST })).rejects.toMatchObject({ statusCode: 401 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─── H-3: delay abort paths ───────────────────────────────────────────────────

describe('withRetry — delay abort (H-3)', () => {
  it('rejects immediately when signal is already aborted before retry delay', async () => {
    const controller = new AbortController();
    controller.abort(new Error('Pre-aborted'));

    const fn = vi.fn().mockRejectedValue({ statusCode: 503 });
    await expect(withRetry(fn, { retryConfig: FAST, signal: controller.signal })).rejects.toThrow('Pre-aborted');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rejects during retry delay when AbortSignal fires mid-delay', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue({ statusCode: 503 });

    // Use a longer delay so the abort fires before the next attempt
    const promise = withRetry(fn, {
      retryConfig: { ...FAST, initialDelayMs: 200, maxDelayMs: 200 },
      signal: controller.signal,
    });

    // Abort while the delay is running
    await new Promise<void>((r) => setTimeout(r, 30));
    controller.abort(new Error('Cancelled mid-delay'));

    await expect(promise).rejects.toThrow('Cancelled mid-delay');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─── normalizeRetryConfig coercion ────────────────────────────────────────────

describe('normalizeRetryConfig', () => {
  it('keeps valid maxAttempts unchanged', () => {
    expect(normalizeRetryConfig({ ...DEFAULT_RETRY, maxAttempts: 5 }).maxAttempts).toBe(5);
  });

  it('coerces maxAttempts: 0 to default', () => {
    expect(normalizeRetryConfig({ ...DEFAULT_RETRY, maxAttempts: 0 }).maxAttempts).toBe(DEFAULT_RETRY.maxAttempts);
  });

  it('coerces negative maxAttempts to default', () => {
    expect(normalizeRetryConfig({ ...DEFAULT_RETRY, maxAttempts: -5 }).maxAttempts).toBe(DEFAULT_RETRY.maxAttempts);
  });

  it('coerces NaN maxAttempts to default', () => {
    expect(normalizeRetryConfig({ ...DEFAULT_RETRY, maxAttempts: NaN }).maxAttempts).toBe(DEFAULT_RETRY.maxAttempts);
  });

  it('coerces Infinity maxAttempts to default', () => {
    expect(normalizeRetryConfig({ ...DEFAULT_RETRY, maxAttempts: Infinity }).maxAttempts).toBe(
      DEFAULT_RETRY.maxAttempts,
    );
  });

  it('floors float maxAttempts', () => {
    expect(normalizeRetryConfig({ ...DEFAULT_RETRY, maxAttempts: 2.9 }).maxAttempts).toBe(2);
  });

  it('passes through other fields unchanged', () => {
    const config = normalizeRetryConfig({
      maxAttempts: 2,
      initialDelayMs: 500,
      maxDelayMs: 10000,
      retryableStatuses: [429, 503],
    });
    expect(config.initialDelayMs).toBe(500);
    expect(config.maxDelayMs).toBe(10000);
    expect(config.retryableStatuses).toEqual([429, 503]);
  });
});
