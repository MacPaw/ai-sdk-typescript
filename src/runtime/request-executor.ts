/**
 * Shared request executor used by both:
 * - the low-level Gateway client (`runRequest`)
 * - the provider/OpenAI-compatible fetch adapter (`createAIGatewayFetch`)
 *
 * This keeps auth refresh, retries, middleware, hooks, timeout handling,
 * request IDs, and transport selection in one place.
 */

import type { RequestConfig, ResolvedConfig, Transport } from './config';
import { AuthError, parseErrorResponseFromResponse } from './errors';
import { withRetry } from './retry';
import { anySignal } from './abort';
import { createFetchTransport } from './transport/fetch';
import { generateRequestId, hasHeaderCaseInsensitive } from './request-id';

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

export interface ExecuteRequestInput {
  url: string;
  method: string;
  body?: RequestInit['body'];
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Extra fetch/transport init passed through without affecting pipeline semantics. */
  transportOptions?: Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'>;
}

export interface ExecuteRequestBehavior {
  /** Merge client/provider-level default headers before per-request headers. */
  includeConfigHeaders?: boolean;
  /** Resolve and inject Bearer auth via `getAuthToken()`. */
  includeAuth?: boolean;
  /** Auto-add `X-Request-ID` when enabled and missing. */
  includeRequestId?: boolean;
  /** Convert non-OK responses into normalized gateway errors. */
  normalizeErrors?: boolean;
  /** Retry once on auth failure by forcing a fresh token. */
  allowAuthRetry?: boolean;
  /** Request ID prefix used for correlation, e.g. `sdk` or `provider`. */
  requestIdPrefix?: string;
}

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
  if (hasRetryableNodeErrorCode(err)) return true;
  if (isFetchFailureTypeError(err)) return true;
  return false;
}

function redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = key.toLowerCase() === 'authorization' ? '[REDACTED]' : value;
  }
  return redacted;
}

function shouldAutoSetJsonContentType(body: RequestInit['body'], headers: Record<string, string>): boolean {
  if (body == null || hasHeaderCaseInsensitive(headers, 'content-type')) return false;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  return !isFormData && !isBlob;
}

const builtinFetchTransport: Transport = createFetchTransport();

function resolveTransport(config: ResolvedConfig): Transport {
  return config.transport ?? builtinFetchTransport;
}

export async function executeRequestPipeline(
  config: ResolvedConfig,
  request: ExecuteRequestInput,
  behavior?: ExecuteRequestBehavior,
): Promise<Response> {
  const normalizedBehavior: Required<ExecuteRequestBehavior> = {
    includeConfigHeaders: behavior?.includeConfigHeaders ?? true,
    includeAuth: behavior?.includeAuth ?? true,
    includeRequestId: behavior?.includeRequestId ?? true,
    normalizeErrors: behavior?.normalizeErrors ?? true,
    allowAuthRetry: behavior?.allowAuthRetry ?? true,
    requestIdPrefix: behavior?.requestIdPrefix ?? 'sdk',
  };

  return executeWithAuth(config, request, normalizedBehavior, false);
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
    if (behavior.allowAuthRetry && !isTokenRetry && config.autoRefreshToken && err instanceof AuthError) {
      config.logger.info?.('[ai-gateway-sdk] 401 received, refreshing token and retrying');
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
  const { logger, hooks } = config;
  const transport = resolveTransport(config);

  const headers: Record<string, string> = {
    ...(behavior.includeConfigHeaders ? config.headers : undefined),
    ...request.headers,
  };

  if (behavior.includeAuth) {
    const token = await config.getAuthToken(forceRefreshToken);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'authorization') delete headers[key];
      }
    }
  }

  if (shouldAutoSetJsonContentType(request.body, headers)) {
    headers['Content-Type'] = 'application/json';
  }

  if (behavior.includeRequestId && config.generateRequestId && !hasHeaderCaseInsensitive(headers, 'x-request-id')) {
    headers['X-Request-ID'] = generateRequestId(behavior.requestIdPrefix);
  }

  const timeoutMs = config.timeout;
  const userSignal = request.signal;

  logger.debug?.('[ai-gateway-sdk] request', request.method, request.url);

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
      headers,
      body: request.body,
      signal,
      transportOptions: request.transportOptions,
    };

    const { middleware } = config;
    let index = 0;

    const next = async (currentRequest: RequestConfig): Promise<Response> => {
      if (index < middleware.length) {
        const middlewareItem = middleware[index++];
        return middlewareItem(currentRequest, next);
      }

      await hooks.onRequest?.(currentRequest);
      return transport.request(currentRequest);
    };

    try {
      let response: Response;
      try {
        response = await next(requestConfig);
      } catch (err) {
        await hooks.onError?.(err, requestConfig);
        throw err;
      }

      if (!response.ok) {
        logger.warn?.('[ai-gateway-sdk] error response', response.status, requestConfig.url);

        if (behavior.normalizeErrors) {
          try {
            await parseErrorResponseFromResponse(response);
          } catch (err) {
            await hooks.onError?.(err, requestConfig);
            throw err;
          }
        }

        return response;
      }

      logger.debug?.('[ai-gateway-sdk] response', response.status, requestConfig.url);
      await hooks.onResponse?.(requestConfig, response);
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (config.retry) {
    return withRetry(doRequest, {
      retryConfig: config.retry,
      signal: userSignal,
      isNetworkError,
      onRetry: async (attempt, err) => {
        config.logger.info?.('[ai-gateway-sdk] retrying', attempt, err);
        await hooks.onRetry?.(attempt, err, {
          url: request.url,
          method: request.method,
          headers: redactSensitiveHeaders(headers),
          body: request.body,
          signal: userSignal,
          transportOptions: request.transportOptions,
        });
      },
    });
  }

  return doRequest();
}
