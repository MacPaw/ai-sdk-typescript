/**
 * Speech synthesis client for the AI Gateway SDK.
 *
 * Wraps two Gateway endpoints:
 *   POST   /v1/speech    — text-to-speech synthesis (streaming-only, SSE)
 *   GET    /v1/voices    — list available voices per model / provider
 *
 * Internally reuses the shared `executeRequestPipeline` + `resolveConfig`
 * primitives — the same approach taken by `gateway-videos.ts`.
 */

import type { GatewayProviderSettings } from './gateway-config';
import { resolveConfig, resolveGatewayBaseURL } from './gateway-config';
import { executeRequestPipeline } from './gateway-request';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single voice entry returned by `GET /v1/voices`. */
export interface Voice {
  /** Unique voice identifier (OpenAI voice name or ElevenLabs voice_id). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Provider that owns this voice (e.g. `"openai"`, `"elevenlabs"`). */
  provider: string;
  /** Any extra voice metadata returned by the gateway. */
  [key: string]: unknown;
}

/** Response envelope for `GET /v1/voices`. */
export interface VoicesResponse {
  data: Voice[];
  [key: string]: unknown;
}

/**
 * Request body for `POST /v1/speech`.
 *
 * The endpoint is **streaming-only** — `stream_format` must be `"sse"` or
 * absent; `"audio"` is rejected with 400 by the gateway.
 */
export interface SpeechSynthesisRequest {
  /**
   * Model identifier in `provider/model` form.
   * e.g. `"openai/gpt-4o-mini-tts"` or `"elevenlabs/eleven_multilingual_v2"`.
   */
  model: string;
  /** Text to synthesize. */
  input: string;
  /** Provider voice: an OpenAI voice name (e.g. `"alloy"`) or an ElevenLabs `voice_id`. */
  voice: string;
  /**
   * Codec / format string.
   * OpenAI: `"mp3"` | `"opus"` | `"aac"` | `"flac"` | `"wav"` | `"pcm"`.
   * ElevenLabs: `codec_samplerate_bitrate` tokens such as `"mp3_44100_128"` or `"pcm_16000"`.
   */
  response_format?: string;
  /**
   * Stream format.  May be `"sse"` or omitted.  `"audio"` is rejected by the gateway.
   */
  stream_format?: 'sse';
  /** Any additional provider-specific fields. */
  [key: string]: unknown;
}

/**
 * Options for `createSpeechClient`.
 * Accepts either `baseURL` or `env: 'production'` — the same convention used
 * by `createGatewayProvider` and `createVideoClient`.
 */
export type GatewaySpeechClientOptions = GatewayProviderSettings;

/** Public interface returned by `createSpeechClient`. */
export interface SpeechClient {
  /**
   * Synthesize text to speech.
   *
   * Returns the raw `Response` from the gateway — the caller can consume
   * `.body` as a ReadableStream (SSE) or call `.text()` to collect the full
   * SSE payload.  The gateway always streams; no buffered audio path exists.
   */
  synthesize(request: SpeechSynthesisRequest): Promise<Response>;

  /**
   * List available voices for the given provider / model.
   *
   * @param model  Optional `provider` or `provider/model` filter
   *               (e.g. `"openai"` or `"elevenlabs/eleven_multilingual_v2"`).
   */
  listVoices(model?: string): Promise<VoicesResponse>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a `SpeechClient` that talks to the AI Gateway speech endpoints.
 *
 * @example
 * ```ts
 * // With an explicit URL:
 * const speech = createSpeechClient({
 *   baseURL: 'https://api.macpaw.com/ai',
 *   getAuthToken: () => Promise.resolve(myJwt),
 * });
 *
 * // Or using the production environment shorthand:
 * const speech = createSpeechClient({
 *   env: 'production',
 *   getAuthToken: () => Promise.resolve(myJwt),
 * });
 *
 * const response = await speech.synthesize({
 *   model: 'openai/gpt-4o-mini-tts',
 *   input: 'Hello, world!',
 *   voice: 'alloy',
 * });
 * // Consume the SSE stream:
 * const text = await response.text();
 * ```
 */
export function createSpeechClient(options: GatewaySpeechClientOptions): SpeechClient {
  const resolvedBaseURL = resolveGatewayBaseURL(options.baseURL, options.env, 'createSpeechClient');
  const base = resolvedBaseURL.replace(/\/$/, '');
  const resolvedConfig = resolveConfig({ ...options, baseURL: resolvedBaseURL });
  // POST synthesize() is non-idempotent and produces a streaming response:
  // retrying on 5xx risks duplicate synthesis requests.
  // Auth retry (401 → fresh token) is still handled at the behavior level.
  const noRetryConfig = { ...resolvedConfig, retry: false as const };

  const pipelineOptions = {
    includeAuth: true,
    normalizeErrors: true,
    allowAuthRetry: true,
  };

  return {
    async synthesize(request: SpeechSynthesisRequest): Promise<Response> {
      return executeRequestPipeline(
        noRetryConfig,
        {
          url: `${base}/v1/speech`,
          method: 'POST',
          body: JSON.stringify(request),
        },
        pipelineOptions,
      );
    },

    async listVoices(model?: string): Promise<VoicesResponse> {
      const url = model
        ? `${base}/v1/voices?model=${encodeURIComponent(model)}`
        : `${base}/v1/voices`;

      const response = await executeRequestPipeline(
        resolvedConfig,
        {
          url,
          method: 'GET',
        },
        pipelineOptions,
      );

      try {
        return (await response.json()) as VoicesResponse;
      } catch {
        throw new Error('Failed to parse voices response as JSON');
      }
    },
  };
}
