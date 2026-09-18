/**
 * Voices client for the AI Gateway SDK.
 *
 * Wraps the Gateway endpoint:
 *   GET    /ai/v1/voices                           — list available voices
 *
 * Internally reuses the shared `executeRequestPipeline` + `resolveConfig`
 * primitives — the same approach taken by `gateway-fetch.ts`.
 */

import type { GatewayProviderSettings } from './gateway-config';
import { resolveConfig, resolveGatewayBaseURL } from './gateway-config';
import { AIGatewayError, ErrorCode } from './gateway-errors';
import { executeRequestPipeline } from './gateway-request';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * AI voice provider identifier.
 *
 * Deliberately an open union: `"elevenlabs"` is the only provider available
 * today and is offered as an editor autocomplete hint.
 */
export type VoiceProvider = 'elevenlabs' | (string & {});

/**
 * A single voice available through the AI Gateway.
 *
 * `voice_id` is always present; every other field is provider-specific
 * and optional (passed through from the upstream provider as-is).
 */
export interface Voice {
  /** Unique voice identifier. */
  voice_id: string;
  /** All other fields are provider-specific and optional. */
  [key: string]: unknown;
}

/** Response envelope returned by `GET /v1/voices`. */
export interface VoicesListResponse {
  /** Array of available voices. */
  voices: Voice[];
  /** Whether more pages are available. */
  has_more: boolean;
  /** Total number of voices available from the provider. */
  total_count: number;
  /** Token to pass as `next_page_token` for the next page. */
  next_page_token: string;
}

/** Query parameters accepted by `VoiceClient.list()`. */
export interface ListVoicesParams {
  /**
   * AI voice provider to list voices from.
   * `"elevenlabs"` is the only provider available today; any other provider
   * the Gateway starts supporting can be passed as a plain string.
   */
  provider: VoiceProvider;
  /**
   * Pagination cursor returned by the previous request.
   * Use together with `has_more` for reliable pagination.
   */
  next_page_token?: string;
}

/**
 * Options for `createVoiceClient`.
 * Accepts either `baseURL` or `env: 'production'` — the same convention used by
 * `createGatewayProvider` and `createAIGatewayProvider`.
 */
export type GatewayVoiceClientOptions = GatewayProviderSettings;

/** Public interface returned by `createVoiceClient`. */
export interface VoiceClient {
  /** Retrieve the list of voices available through the AI Gateway. */
  list(params: ListVoicesParams): Promise<VoicesListResponse>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a `VoiceClient` that talks to the AI Gateway voices endpoint.
 *
 * @example
 * ```ts
 * // With an explicit URL:
 * const voices = createVoiceClient({
 *   baseURL: 'https://api.macpaw.com/ai',
 *   getAuthToken: () => Promise.resolve(myJwt),
 * });
 *
 * // Or using the production environment shorthand:
 * const voices = createVoiceClient({
 *   env: 'production',
 *   getAuthToken: () => Promise.resolve(myJwt),
 * });
 *
 * const result = await voices.list({ provider: 'elevenlabs' });
 * ```
 */
export function createVoiceClient(options: GatewayVoiceClientOptions): VoiceClient {
  const resolvedBaseURL = resolveGatewayBaseURL(options.baseURL, options.env, 'createVoiceClient');
  const base = resolvedBaseURL.replace(/\/$/, '');
  const resolvedConfig = resolveConfig({ ...options, baseURL: resolvedBaseURL });

  const pipelineOptions = {
    includeAuth: true,
    normalizeErrors: true,
    allowAuthRetry: true,
  };

  return {
    async list(params: ListVoicesParams): Promise<VoicesListResponse> {
      const query = new URLSearchParams({ provider: params.provider });
      if (params.next_page_token !== undefined) {
        query.set('next_page_token', params.next_page_token);
      }

      const response = await executeRequestPipeline(
        resolvedConfig,
        {
          url: `${base}/v1/voices?${query.toString()}`,
          method: 'GET',
        },
        pipelineOptions,
      );
      try {
        return (await response.json()) as VoicesListResponse;
      } catch (err) {
        throw new AIGatewayError(
          'Failed to parse voices list response as JSON',
          ErrorCode.InternalServerError,
          response.status,
          {},
          { cause: err },
        );
      }
    },
  };
}
