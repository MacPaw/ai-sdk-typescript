/**
 * Custom fetch factory for use with Vercel AI SDK and other OpenAI-compatible clients.
 * Use this with createOpenAI({ baseURL, fetch: createAIGatewayFetch(...) }) or similar.
 *
 * AI Gateway BFF paths are under /api/v1 (e.g. /api/v1/chat/completions).
 * So baseURL should be the BFF root, e.g. https://api.macpaw.com/ai
 */

export interface CreateAIGatewayFetchOptions {
  baseURL: string;
  getAuthToken: () => Promise<string | null>;
  headers?: Record<string, string>;
}

/**
 * Returns a fetch-like function that adds Bearer auth and fixes URL to the AI Gateway BFF.
 * Use with Vercel AI SDK:
 *
 * @example
 * import { createAIGatewayFetch } from '@macpaw/ai/provider';
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
export function createAIGatewayFetch(options: CreateAIGatewayFetchOptions): (input: string | URL | { url: string }, init?: RequestInit) => Promise<Response> {
  const { baseURL, getAuthToken, headers: extraHeaders = {} } = options;
  const base = baseURL.replace(/\/$/, '');

  return async function aiGatewayFetch(
    input: string | URL | { url: string },
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const token = await getAuthToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    Object.entries(extraHeaders).forEach(([k, v]) => headers.set(k, v));
    const body = init?.body;
    const isFormDataLike = typeof FormData !== 'undefined' && body instanceof FormData;
    const isBlobLike = typeof Blob !== 'undefined' && body instanceof Blob;
    if (!headers.has('Content-Type') && !isFormDataLike && !isBlobLike) {
      headers.set('Content-Type', 'application/json');
    }

    const resolvedUrl = url.startsWith(base) ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    return fetch(resolvedUrl, { ...init, headers });
  };
}
