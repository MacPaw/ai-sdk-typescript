/**
 * Custom fetch factory for use with Vercel AI SDK and other OpenAI-compatible clients.
 * Use this with createOpenAI({ baseURL, fetch: createGatewayFetch(...) }) or similar.
 *
 * AI Gateway HTTP paths are under /api/v1 (e.g. /api/v1/chat/completions).
 * So baseURL should be the gateway root, e.g. https://api.macpaw.com/ai
 *
 * Internally delegates to the shared request pipeline while guarding against
 * leaking gateway auth/headers to non-gateway hosts.
 */

import type { GatewayProviderSettings } from '../gateway-config';
import { resolveConfig } from '../gateway-config';
import { executeRequestPipeline } from '../gateway-request';

/**
 * Config for `createAIGatewayFetch`.
 * Extends GatewayProviderSettings with baseURL required (already resolved)
 * and normalizeErrors (provider-specific behavior).
 */
export interface AIGatewayFetchFactoryConfig extends GatewayProviderSettings {
  /** Resolved Gateway base URL (required — use resolveGatewayBaseURL first). */
  baseURL: string;
  /**
   * Normalize gateway error responses into `AIGatewayError`. Default: true.
   * When enabled, non-OK gateway responses throw instead of returning a failed Response.
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

function stripPlaceholderAuthorization(headers: Headers, placeholder: string): void {
  const auth = headers.get('authorization');
  if (auth === `Bearer ${placeholder}`) {
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

export const GATEWAY_PLACEHOLDER_API_KEY = 'ai-gateway-auth-via-fetch';

export function createAIGatewayFetch(
  options: AIGatewayFetchFactoryConfig,
): (input: FetchInput, init?: RequestInit) => Promise<Response> {
  const { baseURL, normalizeErrors = true } = options;
  const base = baseURL.replace(/\/$/, '');
  const gatewayBaseUrl = new URL(base);
  const resolvedConfig = resolveConfig({
    baseURL: base,
    getAuthToken: options.getAuthToken,
    headers: options.headers,
    retry: options.retry,
    middleware: options.middleware,
    timeout: options.timeout,
    fetch: options.fetch,
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
      stripPlaceholderAuthorization(headers, GATEWAY_PLACEHOLDER_API_KEY);
    }

    return executeRequestPipeline(
      resolvedConfig,
      {
        url: resolvedUrl.toString(),
        method: init?.method ?? requestClone?.method ?? 'GET',
        headers: headersToRecord(headers),
        body: init?.body ?? requestClone?.body,
        signal: init?.signal ?? requestClone?.signal,
      },
      {
        includeConfigHeaders: isGatewayRequest,
        includeAuth: isGatewayRequest,
        includeRequestId: isGatewayRequest,
        normalizeErrors: isGatewayRequest && normalizeErrors,
        allowAuthRetry: isGatewayRequest,
        requestIdPrefix: 'provider',
      },
    );
  };
}
