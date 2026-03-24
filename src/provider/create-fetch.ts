/**
 * Custom fetch factory for use with Vercel AI SDK and other OpenAI-compatible clients.
 * Use this with createOpenAI({ baseURL, fetch: createAIGatewayFetch(...) }) or similar.
 *
 * AI Gateway HTTP paths are under /api/v1 (e.g. /api/v1/chat/completions).
 * So baseURL should be the gateway root, e.g. https://api.macpaw.com/ai
 */

import { parseErrorResponseFromResponse } from '../runtime/errors';

export interface CreateAIGatewayFetchOptions {
  baseURL: string;
  /** Returns the Bearer token for each request. */
  getAuthToken: (forceRefresh?: boolean) => Promise<string | null>;
  headers?: Record<string, string>;
  /** Automatically retry once on 401 after forcing token refresh. Default: true. */
  autoRefreshToken?: boolean;
  /** Cache the auth token for this many milliseconds. Default: 0. */
  tokenCacheTTL?: number;
  /** Generate `X-Request-ID` for requests that do not already have one. Default: true. */
  generateRequestId?: boolean;
  /**
   * Normalize gateway error responses into `AIGatewayError`. Default: true.
   * When enabled, non-OK gateway responses throw instead of returning a failed `Response`.
   */
  normalizeErrors?: boolean;
}

type FetchInput = string | URL | Request | { url: string };

let providerRequestIdCounter = 0;

function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (providerRequestIdCounter++).toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `provider-${timestamp}-${counter}-${random}`;
}

function resolveRequestUrl(input: FetchInput): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function cloneHeaders(headers?: RequestInit['headers']): Headers {
  return new Headers(headers);
}

function joinBaseUrl(baseURL: string, path: string): string {
  return `${baseURL}${path.startsWith('/') ? '' : '/'}${path}`;
}

function isGatewayUrl(url: URL, gatewayBaseUrl: URL): boolean {
  const gatewayPath = gatewayBaseUrl.pathname.replace(/\/$/, '');
  const requestPath = url.pathname.replace(/\/$/, '');

  return (
    url.origin === gatewayBaseUrl.origin &&
    (requestPath === gatewayPath || requestPath.startsWith(`${gatewayPath}/`))
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
    generateRequestId: shouldGenerateRequestId = true,
    normalizeErrors = true,
  } = options;

  const base = baseURL.replace(/\/$/, '');
  const gatewayBaseUrl = new URL(base);
  let cachedToken: string | null = null;
  let cacheExpiresAt = 0;
  let pendingRefresh: Promise<string | null> | null = null;
  let pendingIsForced = false;

  async function loadToken(forceRefresh = false): Promise<string | null> {
    if (tokenCacheTTL <= 0) {
      return getAuthToken(forceRefresh);
    }

    if (!forceRefresh && Date.now() < cacheExpiresAt) {
      return cachedToken;
    }

    if (forceRefresh && pendingRefresh && !pendingIsForced) {
      pendingRefresh = null;
    }

    if (!pendingRefresh) {
      pendingIsForced = forceRefresh;
      pendingRefresh = getAuthToken(forceRefresh).then(
        (token) => {
          cachedToken = token;
          cacheExpiresAt = token == null ? 0 : Date.now() + tokenCacheTTL;
          pendingRefresh = null;
          return token;
        },
        (error) => {
          pendingRefresh = null;
          throw error;
        },
      );
    }

    return pendingRefresh;
  }

  function resetCachedToken(): void {
    cachedToken = null;
    cacheExpiresAt = 0;
    pendingRefresh = null;
    pendingIsForced = false;
  }

  return async function aiGatewayFetch(input: FetchInput, init?: RequestInit): Promise<Response> {
    const rawUrl = resolveRequestUrl(input);
    const isAbsolute = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
    const resolvedUrl = new URL(isAbsolute ? rawUrl : joinBaseUrl(base, rawUrl));
    const isGatewayRequest = isGatewayUrl(resolvedUrl, gatewayBaseUrl);

    const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;

    async function execute(forceRefresh = false): Promise<Response> {
      const requestClone = request?.clone();
      const headers = cloneHeaders(requestClone?.headers);

      if (init?.headers) {
        for (const [key, value] of new Headers(init.headers).entries()) {
          headers.set(key, value);
        }
      }

      if (isGatewayRequest) {
        const token = await loadToken(forceRefresh);
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        } else {
          headers.delete('Authorization');
        }

        for (const [key, value] of Object.entries(extraHeaders)) {
          headers.set(key, value);
        }

        if (
          shouldGenerateRequestId &&
          !Array.from(headers.keys()).some((key) => key.toLowerCase() === 'x-request-id')
        ) {
          headers.set('X-Request-ID', generateRequestId());
        }
      }

      const body = init?.body ?? requestClone?.body;
      if (body != null && !headers.has('Content-Type')) {
        const isFormDataLike = typeof FormData !== 'undefined' && body instanceof FormData;
        const isBlobLike = typeof Blob !== 'undefined' && body instanceof Blob;
        if (!isFormDataLike && !isBlobLike) {
          headers.set('Content-Type', 'application/json');
        }
      }

      const response = await fetch(resolvedUrl.toString(), {
        ...init,
        method: init?.method ?? requestClone?.method,
        headers,
        body,
        signal: init?.signal ?? requestClone?.signal,
      });

      if (isGatewayRequest && response.status === 401 && autoRefreshToken && !forceRefresh) {
        resetCachedToken();
        return execute(true);
      }

      if (isGatewayRequest && normalizeErrors && !response.ok) {
        await parseErrorResponseFromResponse(response.clone());
      }

      return response;
    }

    return execute(false);
  };
}
