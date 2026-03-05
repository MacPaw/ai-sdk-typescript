/**
 * Custom fetch factory for use with Vercel AI SDK and other OpenAI-compatible clients.
 * Use this with createOpenAI({ baseURL, fetch: createAIGatewayFetch(...) }) or similar.
 *
 * AI Gateway BFF paths are under /api/v1 (e.g. /api/v1/chat/completions).
 * So baseURL should be the BFF root, e.g. https://api.macpaw.com/ai
 */

export interface CreateAIGatewayFetchOptions {
  baseURL: string;
  /**
   * Returns the Bearer token for each request.
   *
   * **Note:** Unlike the main `createAIGatewayClient`, this fetch wrapper does
   * **not** support automatic 401 retry with `forceRefresh`. If the token expires
   * mid-session, the consumer (e.g. Vercel AI SDK) will receive a 401 error.
   * Handle token refresh in your `getAuthToken` implementation or use the main
   * client with `autoRefreshToken: true` for full retry support.
   */
  getAuthToken: () => Promise<string | null>;
  headers?: Record<string, string>;
}

/**
 * Returns a fetch-like function that adds Bearer auth and fixes URL to the AI Gateway BFF.
 * Use with Vercel AI SDK:
 *
 * @example
 * import { createAIGatewayFetch } from '@macpaw/ai-sdk/provider';
 * import { createOpenAI } from '@ai-sdk/openai';
 *
 * const fetch = createAIGatewayFetch({
 *   baseURL: 'https://api.macpaw.com/ai',
 *   getAuthToken: async () => (await getSetappSession()).accessToken,
 * });
 *
 * const openai = createOpenAI({
 *   baseURL: 'https://api.macpaw.com/ai/api/v1',
 *   fetch,
 *   apiKey: 'unused',
 * });
 */
export function createAIGatewayFetch(options: CreateAIGatewayFetchOptions): (input: string | URL | Request | { url: string }, init?: RequestInit) => Promise<Response> {
  const { baseURL, getAuthToken, headers: extraHeaders = {} } = options;
  const base = baseURL.replace(/\/$/, '');

  return async function aiGatewayFetch(
    input: string | URL | Request | { url: string },
    init?: RequestInit
  ): Promise<Response> {
    // Derive defaults from Request objects so method/headers/body aren't silently dropped.
    if (typeof Request !== 'undefined' && input instanceof Request) {
      init = {
        method: input.method,
        headers: input.headers,
        body: input.body,
        signal: input.signal,
        ...init,
      };
    }

    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as { url: string }).url;
    const isAbsoluteExternal = (url.startsWith('http://') || url.startsWith('https://')) && !url.startsWith(base);
    const resolvedUrl = (url.startsWith('http://') || url.startsWith('https://'))
      ? url
      : `${base}${url.startsWith('/') ? '' : '/'}${url}`;

    const headers = new Headers(init?.headers);

    // Only inject auth + extra headers for requests targeting the configured base.
    if (!isAbsoluteExternal) {
      const token = await getAuthToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      Object.entries(extraHeaders).forEach(([k, v]) => headers.set(k, v));
    }

    const body = init?.body;
    if (body != null && !headers.has('Content-Type')) {
      const isFormDataLike = typeof FormData !== 'undefined' && body instanceof FormData;
      const isBlobLike = typeof Blob !== 'undefined' && body instanceof Blob;
      if (!isFormDataLike && !isBlobLike) {
        headers.set('Content-Type', 'application/json');
      }
    }

    return fetch(resolvedUrl, { ...init, headers });
  };
}
