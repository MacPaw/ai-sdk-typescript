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

import type { GatewayProviderSettings } from './gateway-config';
import { resolveConfig } from './gateway-config';
import { executeRequestPipeline } from './gateway-request';

export const GATEWAY_PLACEHOLDER_API_KEY = 'ai-gateway-auth-via-fetch';

/**
 * Config for `createGatewayFetch`.
 * Extends GatewayProviderSettings with baseURL required (already resolved)
 * and normalizeErrors (provider-specific behavior).
 */
export interface GatewayFetchConfig extends GatewayProviderSettings {
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

/**
 * Trims, strips a single layer of surrounding ASCII quotes, and removes
 * trailing comma/semicolon noise often introduced by .env or copy-paste.
 */
export function normalizeBearerToken(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }

  s = s.replace(/[,;]+\s*$/g, '').trim();
  return s.length > 0 ? s : null;
}

/**
 * Removes Authorization when it is only the OpenAI apiKey placeholder (optional trailing comma),
 * so a real Bearer from getAuthToken() is not merged with a junk value.
 */
function stripPlaceholderAuthorization(headers: Headers, placeholder: string): void {
  const auth = headers.get('authorization');
  if (!auth) return;
  const m = auth.match(/^Bearer\s+(\S+)/i);
  if (!m) return;
  const credential = normalizeBearerToken(m[1]);
  if (credential === placeholder) {
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

export function createGatewayFetch(
  options: GatewayFetchConfig,
): (input: FetchInput, init?: RequestInit) => Promise<Response> {
  const { baseURL, normalizeErrors = true } = options;
  const base = baseURL.replace(/\/$/, '');
  const gatewayBaseUrl = new URL(base);
  const resolvedConfig = resolveConfig({ ...options, baseURL: base });

  return async function gatewayFetch(input: FetchInput, init?: RequestInit): Promise<Response> {
    const rawUrl = resolveRequestUrl(input);
    const isAbsolute = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
    const resolvedUrl = new URL(isAbsolute ? rawUrl : joinBaseUrl(base, rawUrl));
    const isGatewayRequest = isGatewayUrl(resolvedUrl, gatewayBaseUrl);

    const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
    const requestClone = request?.clone();
    const headers = new Headers(requestClone?.headers);

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
