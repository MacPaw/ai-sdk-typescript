/**
 * Web search client: `POST /ai/v1/websearch`.
 *
 * Only the Gateway contract is typed; provider fields are forwarded as sent and
 * the provider's response is returned unchanged.
 */

import type { GatewayProviderSettings } from './gateway-config';
import { resolveConfig, resolveGatewayBaseURL } from './gateway-config';
import { AIGatewayError, ErrorCode } from './gateway-errors';
import { executeRequestPipeline } from './gateway-request';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The searcher's position. */
export interface WebSearchLocation {
  /** `-90`…`90`. */
  latitude?: number;
  /** `-180`…`180`. */
  longitude?: number;
}

/** Request body for `WebSearchClient.search()`. */
export interface WebSearchRequest {
  /** `provider/model`, e.g. `"exa/exa"`. */
  model: string;
  query: string;
  /** Number of results. */
  limit?: number;
  include_domains?: string[];
  exclude_domains?: string[];
  /** ISO 3166-1 alpha-2 code. */
  country?: string;
  location?: WebSearchLocation | null;
  /** The provider's own options, forwarded as sent. */
  provider_options?: Record<string, unknown> | null;
  /** Any other field, forwarded as sent. Names are not checked by the compiler — use the Gateway's. */
  [key: string]: unknown;
}

/**
 * The provider's JSON response, unchanged.
 * Narrow it or pass `T` to `search<T>()`.
 */
export type WebSearchResponse = Record<string, unknown> | unknown[] | string | number | boolean | null;

/** Options for `createWebSearchClient`. */
export type GatewayWebSearchClientOptions = GatewayProviderSettings;

/** Per-call options for `WebSearchClient.search()`. */
export interface WebSearchRequestOptions {
  /** Cancels the search when aborted. */
  signal?: AbortSignal;
}

/** Default timeout (2 minutes): deep searches can be slow, and an aborted search is still billed. */
export const DEFAULT_WEBSEARCH_TIMEOUT_MS = 120_000;

/** Public interface returned by `createWebSearchClient`. */
export interface WebSearchClient {
  /** Search the web; resolves to the provider's parsed JSON response. */
  search<T = WebSearchResponse>(request: WebSearchRequest, options?: WebSearchRequestOptions): Promise<T>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a `WebSearchClient`.
 *
 * @example
 * ```ts
 * const websearch = createWebSearchClient({ env: 'production', getAuthToken: () => Promise.resolve(myJwt) });
 * const result = await websearch.search({ model: 'exa/exa', query: 'launch agents on macOS', limit: 5 });
 * ```
 */
export function createWebSearchClient(options: GatewayWebSearchClientOptions): WebSearchClient {
  const resolvedBaseURL = resolveGatewayBaseURL(options.baseURL, options.env, 'createWebSearchClient');
  const base = resolvedBaseURL.replace(/\/$/, '');
  const resolvedConfig = resolveConfig({
    ...options,
    baseURL: resolvedBaseURL,
    timeout: options.timeout ?? DEFAULT_WEBSEARCH_TIMEOUT_MS,
  });
  // No retries: each search is billed. Auth retry on 401 still applies.
  const noRetryConfig = { ...resolvedConfig, retry: false as const };

  const pipelineOptions = {
    includeAuth: true,
    normalizeErrors: true,
    allowAuthRetry: true,
  };

  return {
    async search<T = WebSearchResponse>(
      request: WebSearchRequest,
      requestOptions?: WebSearchRequestOptions,
    ): Promise<T> {
      let body: string;
      try {
        body = JSON.stringify(request);
      } catch (err) {
        // e.g. a BigInt or a circular object in `provider_options`.
        throw new TypeError('createWebSearchClient: request cannot be JSON-encoded.', { cause: err });
      }

      const response = await executeRequestPipeline(
        noRetryConfig,
        {
          url: `${base}/v1/websearch`,
          method: 'POST',
          body,
          signal: requestOptions?.signal,
        },
        pipelineOptions,
      );

      try {
        return (await response.json()) as T;
      } catch (err) {
        throw new AIGatewayError(
          `Failed to parse web search response as JSON (HTTP ${response.status}, ` +
            `content-type: ${response.headers.get('content-type') ?? 'none'})`,
          ErrorCode.InternalServerError,
          response.status,
          {},
          { cause: err },
        );
      }
    },
  };
}
