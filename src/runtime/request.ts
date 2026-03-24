/**
 * Request pipeline: auth -> middleware chain -> transport.
 * Applies getAuthToken, runs middleware, then calls transport.
 * Wires: timeout, logger, AbortSignal propagation, request ID, lifecycle hooks.
 * Supports automatic token refresh on 401.
 */

import type { ResolvedConfig, RequestConfig, Transport } from './config';
import type { RequestOptions } from '../types';
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

/** Substrings of `TypeError.message` that commonly indicate a failed fetch (browser / Node undici). */
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

export async function runRequest(
  config: ResolvedConfig,
  path: string,
  init: { method: string; body?: RequestInit['body']; headers?: Record<string, string>; signal?: AbortSignal },
  options?: RequestOptions,
): Promise<Response> {
  return executeWithAuth(config, path, init, options, false);
}

async function executeWithAuth(
  config: ResolvedConfig,
  path: string,
  init: { method: string; body?: RequestInit['body']; headers?: Record<string, string>; signal?: AbortSignal },
  options: RequestOptions | undefined,
  isTokenRetry: boolean,
): Promise<Response> {
  try {
    return await executeRequest(config, path, init, options, isTokenRetry);
  } catch (err) {
    if (!isTokenRetry && config.autoRefreshToken && err instanceof AuthError) {
      config.logger.info?.('[ai-gateway-sdk] 401 received, refreshing token and retrying');
      return executeWithAuth(config, path, init, options, true);
    }
    throw err;
  }
}

async function executeRequest(
  config: ResolvedConfig,
  path: string,
  init: { method: string; body?: RequestInit['body']; headers?: Record<string, string>; signal?: AbortSignal },
  options: RequestOptions | undefined,
  forceRefreshToken = false,
): Promise<Response> {
  const { logger, hooks } = config;
  const baseURL = config.baseURL.replace(/\/$/, '');
  const url = `${baseURL}${path.startsWith('/') ? path : `/${path}`}`;

  const token = await config.getAuthToken(forceRefreshToken);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...config.headers,
    ...init.headers,
    ...options?.headers,
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  if (config.generateRequestId && !hasHeaderCaseInsensitive(headers, 'x-request-id')) {
    headers['X-Request-ID'] = generateRequestId('sdk');
  }

  const timeoutMs = options?.timeout ?? config.timeout;
  const userSignal = options?.signal ?? init.signal;
  const transport = config.transport ?? customDefaultTransport ?? builtinFetchTransport;

  logger.debug?.('[ai-gateway-sdk] request', init.method, url);

  async function doRequest(): Promise<Response> {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(
      () => timeoutController.abort(new Error(`Request timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );

    const signal = userSignal ? anySignal([userSignal, timeoutController.signal]) : timeoutController.signal;

    const requestConfig: RequestConfig = {
      url,
      method: init.method,
      headers,
      body: init.body,
      signal,
    };

    const { middleware } = config;
    let index = 0;

    const next = async (request: RequestConfig): Promise<Response> => {
      if (index < middleware.length) {
        const middlewareItem = middleware[index++];
        return middlewareItem(request, next);
      }

      await hooks.onRequest?.(request);
      return transport.request(request);
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

        try {
          await parseErrorResponseFromResponse(response);
        } catch (err) {
          await hooks.onError?.(err, requestConfig);
          throw err;
        }
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
          url,
          method: init.method,
          headers: redactSensitiveHeaders(headers),
          body: init.body,
          signal: userSignal,
        });
      },
    });
  }

  return doRequest();
}

const builtinFetchTransport: Transport = createFetchTransport();

let customDefaultTransport: Transport | undefined;

/**
 * Override the default transport for all clients that don't specify their own.
 *
 * @deprecated Mutates module-level state affecting all clients in the process.
 * In serverless/edge environments this can cause cross-request interference.
 * Pass `transport` in the per-client config instead.
 */
export function setDefaultTransport(transport: Transport): void {
  customDefaultTransport = transport;
}

/**
 * Remove the custom default transport, reverting to the built-in fetch transport.
 *
 * @deprecated See {@link setDefaultTransport} deprecation notice.
 */
export function resetDefaultTransport(): void {
  customDefaultTransport = undefined;
}
