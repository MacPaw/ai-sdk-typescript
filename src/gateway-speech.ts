/**
 * Speech (text-to-speech) client for the AI Gateway SDK.
 *
 * Wraps the Gateway endpoint:
 *   POST   /ai/v1/audio/speech                     — generate speech audio (streaming only)
 *
 * Internally reuses the shared `executeRequestPipeline` + `resolveConfig`
 * primitives — the same approach taken by `gateway-fetch.ts`.
 */

import type { GatewayProviderSettings } from './gateway-config';
import { resolveConfig, resolveGatewayBaseURL } from './gateway-config';
import { executeRequestPipeline } from './gateway-request';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Audio codec / container for the generated speech.
 *
 * Values are per-provider: OpenAI codec names (`mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`)
 * are offered as an editor autocomplete hint, but any string is accepted — ElevenLabs uses
 * `codec_samplerate_bitrate` tokens instead (e.g. `mp3_44100_128`, `pcm_16000`).
 */
export type SpeechResponseFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | (string & {});

/**
 * Request body for `SpeechClient.create()`.
 *
 * Only `model`, `input`, and `voice` are required by this endpoint. Every other
 * parameter — its name, bounds, and how it maps onto the provider's own request —
 * is defined per model by the Gateway's Platform AI Model config, not by this
 * endpoint; a field that fails its rule is rejected with `400` before the
 * provider is called. The index signature lets callers pass those model-specific
 * fields (e.g. `speed`, `instructions`) without a type-level allowlist here.
 */
export interface CreateSpeechRequest {
  /** `provider/model`, e.g. `"openai/gpt-4o-mini-tts"` or `"elevenlabs/eleven_multilingual_v2"`. */
  model: string;
  /** Text to synthesize. */
  input: string;
  /** Provider voice: an OpenAI voice name (e.g. `"alloy"`) or an ElevenLabs `voice_id`. */
  voice: string;
  /** Audio codec / container. Provider-specific — see `SpeechResponseFormat`. */
  response_format?: SpeechResponseFormat;
  /**
   * Only `"sse"` is accepted; the response is always a stream. Omit this field
   * or set it to `"sse"` — `"audio"` (a single buffered file) is rejected with `400`.
   */
  stream_format?: 'sse';
  /**
   * When `true`, relay the provider's own stream unmodified instead of normalizing
   * it to OpenAI `speech.audio.delta` / `speech.audio.done` events. For ElevenLabs
   * this is its native JSON stream, including alignment data the OpenAI events
   * cannot carry. Defaults to `false`.
   */
  raw_provider_response?: boolean;
  /** Additional model-specific parameters, validated per model by the Gateway. */
  [key: string]: unknown;
}

/** A single base64-encoded audio chunk in the normalized event stream. */
export interface SpeechAudioDeltaEvent {
  type: 'speech.audio.delta';
  /** Base64-encoded audio chunk. */
  audio: string;
  /** Any additional fields the Gateway includes are passed through as-is. */
  [key: string]: unknown;
}

/** Terminal event marking the end of the normalized event stream. */
export interface SpeechAudioDoneEvent {
  type: 'speech.audio.done';
  /** Any additional fields the Gateway includes are passed through as-is. */
  [key: string]: unknown;
}

/**
 * Normalized SSE event shape sent when `raw_provider_response` is not `true`.
 * Mirrors OpenAI's own speech streaming events so a client written against
 * OpenAI works unchanged regardless of which provider actually served the request.
 */
export type CreateSpeechStreamEvent = SpeechAudioDeltaEvent | SpeechAudioDoneEvent;

/**
 * Options for `createSpeechClient`.
 * Accepts either `baseURL` or `env: 'production'` — the same convention used by
 * `createGatewayProvider` and `createVideoClient`.
 */
export type GatewaySpeechClientOptions = GatewayProviderSettings;

/** Public interface returned by `createSpeechClient`. */
export interface SpeechClient {
  /**
   * Generate speech audio for `input` using `voice`. Always streams: the
   * response is Server-Sent Events by default (`speech.audio.delta` /
   * `speech.audio.done`), or the selected provider's own raw stream when
   * `raw_provider_response` is `true`. Returns the raw `Response` so callers
   * can consume `.body` as a stream — the exact chunk shape and `Content-Type`
   * depend on `raw_provider_response` and the selected provider.
   */
  create(request: CreateSpeechRequest): Promise<Response>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a `SpeechClient` that talks to the AI Gateway speech endpoint.
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
 * const response = await speech.create({
 *   model: 'openai/gpt-4o-mini-tts',
 *   input: 'Today is a wonderful day to build something people love!',
 *   voice: 'alloy',
 *   response_format: 'mp3',
 * });
 *
 * // response.body is a ReadableStream of `text/event-stream` bytes by default —
 * // parse it as SSE to read `speech.audio.delta` / `speech.audio.done` events.
 * ```
 */
export function createSpeechClient(options: GatewaySpeechClientOptions): SpeechClient {
  const resolvedBaseURL = resolveGatewayBaseURL(options.baseURL, options.env, 'createSpeechClient');
  const base = resolvedBaseURL.replace(/\/$/, '');
  const resolvedConfig = resolveConfig({ ...options, baseURL: resolvedBaseURL });
  // POST create() is non-idempotent: retrying on 5xx risks duplicate provider-side
  // speech generation (and duplicate credit charges). Auth retry (401 → fresh
  // token) is still handled at the behavior level.
  const noRetryConfig = { ...resolvedConfig, retry: false as const };

  const pipelineOptions = {
    includeAuth: true,
    normalizeErrors: true,
    allowAuthRetry: true,
  };

  return {
    async create(request: CreateSpeechRequest): Promise<Response> {
      return executeRequestPipeline(
        noRetryConfig,
        {
          url: `${base}/v1/audio/speech`,
          method: 'POST',
          body: JSON.stringify(request),
        },
        pipelineOptions,
      );
    },
  };
}
