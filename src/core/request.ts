/**
 * Request pipeline: auth -> middleware chain -> transport.
 * Applies getAuthToken, runs middleware, then calls transport.
 * Wires: timeout, logger, AbortSignal propagation, request ID, lifecycle hooks.
 * Supports automatic token refresh on 401.
 */

import type { ResolvedConfig, RequestConfig, Transport } from './config';
import type { RequestOptions } from './types';
import { AuthError, parseErrorResponse } from './errors';
import { withRetry } from './retry';

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

  if (config.generateRequestId && !headers['X-Request-ID']) {
    headers['X-Request-ID'] = generateRequestId();
  }

  const timeoutMs = options?.timeout ?? config.timeout;

  const userSignal = options?.signal ?? init.signal;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(new Error(`Request timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );

  let signal: AbortSignal;
  if (userSignal) {
    // Combine user signal with timeout: abort if either fires
    const combined = new AbortController();
    const onAbort = (reason: unknown) => combined.abort(reason);
    if (userSignal.aborted) {
      combined.abort(userSignal.reason);
    } else {
      userSignal.addEventListener('abort', () => onAbort(userSignal.reason), { once: true });
    }
    if (timeoutController.signal.aborted) {
      combined.abort(timeoutController.signal.reason);
    } else {
      timeoutController.signal.addEventListener('abort', () => onAbort(timeoutController.signal.reason), { once: true });
    }
    signal = combined.signal;
  } else {
    signal = timeoutController.signal;
  }

  const requestConfig: RequestConfig = {
    url,
    method: init.method,
    headers,
    body: init.body,
    signal,
  };

  const transport = config.transport ?? customDefaultTransport ?? builtinFetchTransport;

  logger.debug?.('[ai-gateway-sdk] request', requestConfig.method, requestConfig.url);

  async function doRequest(): Promise<Response> {
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
        await hooks.onError?.(err, requestConfig);
        throw err;
      }
    }

    logger.debug?.('[ai-gateway-sdk] response', response.status, requestConfig.url);
    await hooks.onResponse?.(requestConfig, response);
    return response;
  }

  try {
    if (config.retry) {
      return await withRetry(doRequest, {
        retryConfig: config.retry,
        isNetworkError: (err) =>
          err instanceof TypeError && (err.message === 'Failed to fetch' || err.message.includes('fetch')),
        onRetry: async (attempt, err) => {
          logger.info?.('[ai-gateway-sdk] retrying', attempt, err);
          await hooks.onRetry?.(attempt, err, requestConfig);
        },
      });
    }
    return await doRequest();
  } finally {
    clearTimeout(timeoutId);
  }
}

const builtinFetchTransport: Transport = {
  async request(options) {
    return fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: options.signal,
    });
  },
};

let customDefaultTransport: Transport | undefined;

/**
 * Override the default transport for all clients that don't specify their own.
 * Prefer passing `transport` in the client config for per-client control.
 */
export function setDefaultTransport(transport: Transport): void {
  customDefaultTransport = transport;
}
