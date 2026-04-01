/**
 * Shared request execution pipeline for the AI Gateway SDK.
 *
 * Handles: auth injection, Bearer token refresh on 401, middleware chain,
 * timeout, retry, and error normalization. Inlines abort, request-id,
 * and fetch transport as private helpers.
 */

import type { RequestConfig, ResolvedConfig } from './gateway-config';
import { AuthError, parseErrorResponseFromResponse } from './gateway-errors';
import { withRetry } from './gateway-retry';

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Combine multiple AbortSignals — aborts when ANY fires. Uses native AbortSignal.any when available. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const any = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  if (typeof any === 'function') {
    return any(signals);
  }
  const controller = new AbortController();
  const handlers: Array<[AbortSignal, () => void]> = [];
  function cleanup() {
    for (const [sig, handler] of handlers) sig.removeEventListener('abort', handler);
    handlers.length = 0;
  }
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    const handler = () => {
      cleanup();
      controller.abort(signal.reason);
    };
    handlers.push([signal, handler]);
    signal.addEventListener('abort', handler, { once: true });
  }
  controller.signal.addEventListener('abort', cleanup, { once: true });
  return controller.signal;
}

let _counter = 0;
/** Generate a unique request ID for correlation. */
function generateRequestId(prefix: string = 'sdk'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  const timestamp = Date.now().toString(36);
  const count = (_counter++).toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${count}-${random}`;
}

/** Case-insensitive header key lookup. */
function hasHeaderCaseInsensitive(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

function shouldAutoSetJsonContentType(body: RequestInit['body'], headers: Record<string, string>): boolean {
  if (body == null || hasHeaderCaseInsensitive(headers, 'content-type')) return false;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  return !isFormData && !isBlob;
}

function redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = key.toLowerCase() === 'authorization' ? '[REDACTED]' : value;
  }
  return redacted;
}

const NODE_NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
]);

const FETCH_NETWORK_TYPEERROR_HINTS = [
  'failed to fetch',
  'fetch failed',
  'load failed',
  'networkerror',
  'network error when attempting to fetch',
];

function hasRetryableNodeErrorCode(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; depth < 5 && cur != null; depth++) {
    const code = (cur as { code?: string })?.code;
    if (typeof code === 'string' && NODE_NETWORK_CODES.has(code)) return true;
    cur = cur instanceof Error && cur.cause !== undefined ? cur.cause : undefined;
  }
  return false;
}

function isFetchFailureTypeError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const msg = String(err.message).toLowerCase();
  return FETCH_NETWORK_TYPEERROR_HINTS.some((hint) => msg.includes(hint));
}

function isNetworkError(err: unknown): boolean {
  return hasRetryableNodeErrorCode(err) || isFetchFailureTypeError(err);
}

/** Execute a single HTTP request using the configured fetch implementation. */
async function executeFetch(fetchImpl: typeof fetch | undefined, requestConfig: RequestConfig): Promise<Response> {
  const impl = fetchImpl ?? globalThis.fetch;
  if (typeof impl === 'undefined') {
    throw new Error(
      '@macpaw/ai-sdk requires a global `fetch` implementation. ' +
        'Use Node.js 18+ or install a polyfill like `undici`.',
    );
  }
  return impl(requestConfig.url, {
    method: requestConfig.method,
    headers: requestConfig.headers,
    body: requestConfig.body,
    signal: requestConfig.signal,
  });
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ExecuteRequestInput {
  url: string;
  method: string;
  body?: RequestInit['body'];
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ExecuteRequestBehavior {
  /** Merge config-level default headers before per-request headers. */
  includeConfigHeaders?: boolean;
  /** Resolve and inject Bearer auth via `getAuthToken()`. */
  includeAuth?: boolean;
  /** Auto-add `X-Request-ID` when missing. */
  includeRequestId?: boolean;
  /** Convert non-OK responses into normalized gateway errors. */
  normalizeErrors?: boolean;
  /** Retry once on auth failure by forcing a fresh token. */
  allowAuthRetry?: boolean;
  /** Request ID prefix for correlation, e.g. `sdk` or `provider`. */
  requestIdPrefix?: string;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function executeRequestPipeline(
  config: ResolvedConfig,
  request: ExecuteRequestInput,
  behavior?: ExecuteRequestBehavior,
): Promise<Response> {
  const b: Required<ExecuteRequestBehavior> = {
    includeConfigHeaders: behavior?.includeConfigHeaders ?? true,
    includeAuth: behavior?.includeAuth ?? true,
    includeRequestId: behavior?.includeRequestId ?? true,
    normalizeErrors: behavior?.normalizeErrors ?? true,
    allowAuthRetry: behavior?.allowAuthRetry ?? true,
    requestIdPrefix: behavior?.requestIdPrefix ?? 'sdk',
  };
  return executeWithAuth(config, request, b, false);
}

async function executeWithAuth(
  config: ResolvedConfig,
  request: ExecuteRequestInput,
  behavior: Required<ExecuteRequestBehavior>,
  isTokenRetry: boolean,
): Promise<Response> {
  try {
    return await executeRequest(config, request, behavior, isTokenRetry);
  } catch (err) {
    if (behavior.allowAuthRetry && !isTokenRetry && err instanceof AuthError) {
      // ReadableStream bodies are single-consumer: once the first request reads
      // the stream it is consumed and cannot be replayed on the retry attempt.
      if (typeof ReadableStream !== 'undefined' && request.body instanceof ReadableStream) {
        throw err;
      }
      return executeWithAuth(config, request, behavior, true);
    }
    throw err;
  }
}

async function executeRequest(
  config: ResolvedConfig,
  request: ExecuteRequestInput,
  behavior: Required<ExecuteRequestBehavior>,
  forceRefreshToken: boolean,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(behavior.includeConfigHeaders ? config.headers : undefined),
    ...request.headers,
  };

  if (shouldAutoSetJsonContentType(request.body, headers)) {
    headers['Content-Type'] = 'application/json';
  }

  if (behavior.includeRequestId && !hasHeaderCaseInsensitive(headers, 'x-request-id')) {
    headers['X-Request-ID'] = generateRequestId(behavior.requestIdPrefix);
  }

  const timeoutMs = config.timeout;
  const userSignal = request.signal;

  async function doRequest(): Promise<Response> {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(
      () => timeoutController.abort(new Error(`Request timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );

    const signal = userSignal ? anySignal([userSignal, timeoutController.signal]) : timeoutController.signal;

    const requestConfig: RequestConfig = {
      url: request.url,
      method: request.method,
      headers: { ...headers },
      body: request.body,
      signal,
    };

    const { middleware } = config;
    let index = 0;

    const next = async (currentRequest: RequestConfig): Promise<Response> => {
      if (index < middleware.length) {
        const middlewareItem = middleware[index++];
        return middlewareItem(currentRequest, next);
      }
      const finalHeaders = { ...currentRequest.headers };
      if (behavior.includeAuth) {
        const token = await config.getAuthToken(forceRefreshToken);
        if (token) {
          finalHeaders.Authorization = `Bearer ${token}`;
        } else {
          for (const key of Object.keys(finalHeaders)) {
            if (key.toLowerCase() === 'authorization') delete finalHeaders[key];
          }
        }
      }
      return executeFetch(config.fetchImpl, { ...currentRequest, headers: finalHeaders });
    };

    try {
      const response = await next(requestConfig);

      if (!response.ok && behavior.normalizeErrors) {
        await parseErrorResponseFromResponse(response);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (config.retry) {
    // doRequest() re-runs the full middleware chain on each retry attempt.
    // Middleware with side effects (metrics, audit logs) will fire per attempt.
    return withRetry(doRequest, {
      retryConfig: config.retry,
      signal: userSignal,
      isNetworkError,
    });
  }

  return doRequest();
}

/** Redact Authorization for safe logging/debugging. */
export { redactSensitiveHeaders };
