/**
 * Configurable fetch-based transport for browser and Node 18+.
 * Timeout is now managed by the request pipeline; this transport simply
 * forwards the signal from RequestConfig.
 */

import type { Transport, RequestConfig } from '../core/config';

export interface FetchTransportOptions {
  /** Additional fetch init options applied to every request. */
  fetchOptions?: Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'>;
}

export function createFetchTransport(options?: FetchTransportOptions): Transport {
  const extraOptions = options?.fetchOptions ?? {};
  return {
    async request(config: RequestConfig): Promise<Response> {
      if (typeof fetch === 'undefined') {
        throw new Error(
          '@macpaw/ai-sdk requires a global `fetch` implementation. '
          + 'Use Node.js 18+ or install a polyfill like `undici`.',
        );
      }
      return fetch(config.url, {
        ...extraOptions,
        method: config.method,
        headers: config.headers,
        body: config.body,
        signal: config.signal,
      });
    },
  };
}
