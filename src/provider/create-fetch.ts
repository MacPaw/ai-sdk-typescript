/**
 * Custom fetch factory for use with Vercel AI SDK and other OpenAI-compatible clients.
 * Use this with createOpenAI({ baseURL, fetch: createAIGatewayFetch(...) }) or similar.
 *
 * AI Gateway HTTP paths are under /api/v1 (e.g. /api/v1/chat/completions).
 * So baseURL should be the gateway root, e.g. https://api.macpaw.com/ai
 *
 * Internally this delegates to the same shared request pipeline used by the
 * low-level client, while still guarding against leaking gateway auth/headers
 * to non-gateway hosts.
 */

import type { LifecycleHooks, Logger, Middleware, RetryConfig, Transport } from '../runtime/config';
import { resolveConfig } from '../runtime/config';
import { executeRequestPipeline } from '../runtime/request-executor';

export const GATEWAY_PLACEHOLDER_API_KEY = 'ai-gateway-auth-via-fetch';

export interface CreateAIGatewayFetchOptions {
  baseURL: string;
  /** Returns the Bearer token for each request. */
  getAuthToken: (forceRefresh?: boolean) => Promise<string | null>;
  headers?: Record<string, string>;
  /** Automatically retry once on 401 after forcing token refresh. Default: true. */
  autoRefreshToken?: boolean;
  /** Cache the auth token for this many milliseconds. Default: 0. */
  tokenCacheTTL?: number;
  /** Retry policy from the shared request pipeline. Default: the SDK retry policy. */
  retry?: RetryConfig | false;
  /** Middleware chain from the shared request pipeline. */
  middleware?: Middleware[];
  /** Request timeout in ms. Default: 60000. */
  timeout?: number;
  /** Optional logger used by the shared request pipeline. */
  logger?: Logger;
  /** Optional lifecycle hooks used by the shared request pipeline. */
  hooks?: LifecycleHooks;
  /** Optional custom transport used by the shared request pipeline. */
  transport?: Transport;
  /** Generate `X-Request-ID` for requests that do not already have one. Default: true. */
  generateRequestId?: boolean;
  /**
   * Normalize gateway error responses into `AIGatewayError`. Default: true.
   * When enabled, non-OK gateway responses throw instead of returning a failed `Response`.
   */
  normalizeErrors?: boolean;
}

type FetchInput = string | URL | Request | { url: string };

function resolveRequestUrl(input: FetchInput): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function cloneHeaders(headers?: RequestInit['headers']): Headers {
  return new Headers(headers);
}

function stripPlaceholderAuthorization(headers: Headers): void {
  const auth = headers.get('authorization');
  if (auth === `Bearer ${GATEWAY_PLACEHOLDER_API_KEY}`) {
    headers.delete('authorization');
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    record[key] = value;
  }
  return record;
}

function extractTransportOptions(init?: RequestInit): Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'> {
  if (!init) return {};
  const transportOptions = { ...init };
  delete transportOptions.method;
  delete transportOptions.headers;
  delete transportOptions.body;
  delete transportOptions.signal;
  return transportOptions;
}

function joinBaseUrl(baseURL: string, path: string): string {
  return `${baseURL}${path.startsWith('/') ? '' : '/'}${path}`;
}

function isGatewayUrl(url: URL, gatewayBaseUrl: URL): boolean {
  const gatewayPath = gatewayBaseUrl.pathname.replace(/\/$/, '');
  const requestPath = url.pathname.replace(/\/$/, '');

  return (
    url.origin === gatewayBaseUrl.origin && (requestPath === gatewayPath || requestPath.startsWith(`${gatewayPath}/`))
  );
}

export function createAIGatewayFetch(
  options: CreateAIGatewayFetchOptions,
): (input: FetchInput, init?: RequestInit) => Promise<Response> {
  const {
    baseURL,
    getAuthToken,
    headers: extraHeaders = {},
    autoRefreshToken = true,
    tokenCacheTTL = 0,
    retry,
    middleware,
    timeout,
    logger,
    hooks,
    transport,
    generateRequestId: shouldGenerateRequestId = true,
    normalizeErrors = true,
  } = options;

  const base = baseURL.replace(/\/$/, '');
  const gatewayBaseUrl = new URL(base);
  const resolvedConfig = resolveConfig({
    baseURL: base,
    getAuthToken,
    headers: extraHeaders,
    autoRefreshToken,
    tokenCacheTTL,
    retry,
    middleware,
    timeout,
    logger,
    hooks,
    transport,
    generateRequestId: shouldGenerateRequestId,
  });

  return async function aiGatewayFetch(input: FetchInput, init?: RequestInit): Promise<Response> {
    const rawUrl = resolveRequestUrl(input);
    const isAbsolute = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
    const resolvedUrl = new URL(isAbsolute ? rawUrl : joinBaseUrl(base, rawUrl));
    const isGatewayRequest = isGatewayUrl(resolvedUrl, gatewayBaseUrl);

    const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
    const requestClone = request?.clone();
    const headers = cloneHeaders(requestClone?.headers);

    if (init?.headers) {
      for (const [key, value] of new Headers(init.headers).entries()) {
        headers.set(key, value);
      }
    }

    if (!isGatewayRequest) {
      stripPlaceholderAuthorization(headers);
    }

    return executeRequestPipeline(
      resolvedConfig,
      {
        url: resolvedUrl.toString(),
        method: init?.method ?? requestClone?.method ?? 'GET',
        headers: headersToRecord(headers),
        body: init?.body ?? requestClone?.body,
        signal: init?.signal ?? requestClone?.signal,
        transportOptions: extractTransportOptions(init),
      },
      {
        includeConfigHeaders: isGatewayRequest,
        includeAuth: isGatewayRequest,
        includeRequestId: isGatewayRequest,
        normalizeErrors: isGatewayRequest && normalizeErrors,
        allowAuthRetry: isGatewayRequest && autoRefreshToken,
        requestIdPrefix: 'provider',
      },
    );
  };
}
