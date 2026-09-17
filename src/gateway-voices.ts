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

/** A single voice available through the AI Gateway. */
export interface Voice {
  /** Unique voice identifier. */
  id: string;
  /** Human-readable name of the voice. */
  name: string;
  /** Object type discriminator, e.g. `"voice"`. */
  object?: string;
}

/** Response envelope returned by `GET /v1/voices`. */
export interface VoicesListResponse {
  /** Object type discriminator, e.g. `"list"`. */
  object: string;
  /** Array of available voices. */
  data: Voice[];
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
  list(): Promise<VoicesListResponse>;
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
 * const { data } = await voices.list();
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
    async list(): Promise<VoicesListResponse> {
      const response = await executeRequestPipeline(
        resolvedConfig,
        {
          url: `${base}/v1/voices`,
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
