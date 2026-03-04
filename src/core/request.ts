/**
 * Request pipeline: auth -> middleware chain -> transport.
 * Applies getAuthToken, runs middleware, then calls transport.
 * Wires: timeout, logger, AbortSignal propagation, request ID, lifecycle hooks.
 * Supports automatic token refresh on 401.
 */

import type { ResolvedConfig, RequestConfig, Transport } from './config';
import type { RequestOptions } from './types';
import { AIGatewayError, AuthError, parseErrorResponse } from './errors';
import { withRetry } from './retry';
import { anySignal } from './abort';
import { createFetchTransport } from '../transport/fetch';

const NODE_NETWORK_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EPIPE',
  'ETIMEDOUT', 'ENETUNREACH', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT',
]);

/**
 * Detect network errors across runtimes. Per the Fetch spec, a `TypeError`
 * is thrown for network failures — message text varies by engine so we
 * avoid matching on it. Also recognises Node.js system error codes.
 */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const code = (err as { code?: string })?.code;
  if (typeof code === 'string' && NODE_NETWORK_CODES.has(code)) return true;
  return false;
}

/**
 * Parse the standard HTTP Retry-After header into seconds.
 * Supports both delay-seconds (`120`) and HTTP-date formats.
 */
function parseRetryAfterHeader(value: string): number | undefined {
  const seconds = Number(value);
  if (!Number.isNaN(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    const delta = Math.ceil((date - Date.now()) / 1000);
    return delta > 0 ? delta : 0;
  }
  return undefined;
}

let requestIdCounter = 0;

function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (requestIdCounter++).toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `sdk-${timestamp}-${counter}-${random}`;
}

export async function runRequest(
  config: ResolvedConfig,
  path: string,
  init: { method: string; body?: string | FormData; headers?: Record<string, string>; signal?: AbortSignal },
  options?: RequestOptions
): Promise<Response> {
  const result = await executeWithAuth(config, path, init, options, false);
  return result;
}

async function executeWithAuth(
  config: ResolvedConfig,
  path: string,
  init: { method: string; body?: string | FormData; headers?: Record<string, string>; signal?: AbortSignal },
  options: RequestOptions | undefined,
  isTokenRetry: boolean
): Promise<Response> {
  try {
    return await executeRequest(config, path, init, options, isTokenRetry);
  } catch (err) {
    if (
      !isTokenRetry &&
      config.autoRefreshToken &&
      err instanceof AuthError
    ) {
      config.logger.info?.('[ai-gateway-sdk] 401 received, refreshing token and retrying');
      return executeWithAuth(config, path, init, options, true);
    }
    throw err;
  }
}

async function executeRequest(
  config: ResolvedConfig,
  path: string,
  init: { method: string; body?: string | FormData; headers?: Record<string, string>; signal?: AbortSignal },
  options: RequestOptions | undefined,
  forceRefreshToken = false
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
  if (token) headers['Authorization'] = `Bearer ${token}`;

  if (config.generateRequestId && !Object.keys(headers).some(k => k.toLowerCase() === 'x-request-id')) {
    headers['X-Request-ID'] = generateRequestId();
  }

  const timeoutMs = options?.timeout ?? config.timeout;
  const userSignal = options?.signal ?? init.signal;
  const transport = config.transport ?? customDefaultTransport ?? builtinFetchTransport;

  logger.debug?.('[ai-gateway-sdk] request', init.method, url);

  async function doRequest(): Promise<Response> {
    // Timeout is created per attempt so each retry gets a full timeout window,
    // not the remainder from the previous attempt.
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(
      () => timeoutController.abort(new Error(`Request timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );

    const signal = userSignal
      ? anySignal([userSignal, timeoutController.signal])
      : timeoutController.signal;

    const requestConfig: RequestConfig = {
      url,
      method: init.method,
      headers,
      body: init.body,
      signal,
    };

    const { middleware } = config;
    let index = 0;
    const next = async (req: RequestConfig): Promise<Response> => {
      if (index < middleware.length) {
        const mw = middleware[index++];
        return mw(req, next);
      }

      await hooks.onRequest?.(req);
      return transport.request(req);
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
        const contentType = response.headers.get('Content-Type') ?? '';
        let body: unknown;
        if (contentType.includes('application/json')) {
          try {
            body = await response.json();
          } catch {
            body = { message: response.statusText };
          }
        } else {
          body = { message: await response.text().catch(() => response.statusText) };
        }

        logger.warn?.('[ai-gateway-sdk] error response', response.status, body);

        try {
          parseErrorResponse(response.status, body);
        } catch (err) {
          if (err instanceof AIGatewayError && err.retryAfter == null) {
            const raw = response.headers.get('Retry-After');
            if (raw) {
              const seconds = parseRetryAfterHeader(raw);
              if (seconds != null) err.metadata.retryAfter = seconds;
            }
          }
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
      isNetworkError: isNetworkError,
      onRetry: async (attempt, err) => {
        logger.info?.('[ai-gateway-sdk] retrying', attempt, err);
        await hooks.onRetry?.(attempt, err, { url, method: init.method, headers, body: init.body, signal: userSignal });
      },
    });
  }
  return doRequest();
}

const builtinFetchTransport: Transport = createFetchTransport();

let customDefaultTransport: Transport | undefined;

/**
 * Override the default transport for all clients that don't specify their own.
 * Prefer passing `transport` in the client config for per-client control.
 */
export function setDefaultTransport(transport: Transport): void {
  customDefaultTransport = transport;
}

/** Remove the custom default transport, reverting to the built-in fetch transport. */
export function resetDefaultTransport(): void {
  customDefaultTransport = undefined;
}
