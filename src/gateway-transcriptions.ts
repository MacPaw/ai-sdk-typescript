/**
 * Audio transcription (speech-to-text) client for the AI Gateway SDK.
 *
 * Wraps the Gateway endpoint:
 *   POST   /ai/v2/audio/transcriptions             — transcribe audio (multipart)
 *
 * Supersedes `POST /ai/v1/audio/transcriptions` (reached through the provider's
 * `transcription()` model or `createGatewayFetch`), which is deprecated.
 *
 * The SDK types only the Gateway's own contract (`model`, the audio source,
 * `language`, `stream`). Every other field is provider-specific — which ones
 * apply, and the response shape, are decided by the model's provider and
 * validated by the Gateway — so they are forwarded as sent and the provider's
 * response is returned unchanged. New providers or parameters need no SDK change.
 *
 * Internally reuses the shared `executeRequestPipeline` + `resolveConfig`
 * primitives — the same approach taken by `gateway-fetch.ts`.
 */

import type { GatewayProviderSettings } from './gateway-config';
import { resolveConfig, resolveGatewayBaseURL } from './gateway-config';
import { AIGatewayError, ErrorCode } from './gateway-errors';
import { executeRequestPipeline } from './gateway-request';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Fields shared by every transcription request, regardless of how the audio is supplied. */
export interface TranscriptionRequestBase {
  /** Model id in `provider/model` format, e.g. `"openai/gpt-4o-transcribe"` or `"elevenlabs/scribe_v2"`. */
  model: string;
  /**
   * Language of the audio; omit to auto-detect. Accepted for every provider —
   * the Gateway maps it to the provider's own field (e.g. ElevenLabs `language_code`).
   */
  language?: string;
  /**
   * When `true`, the response is `text/event-stream` and `create()` returns the raw
   * `Response`. Only some providers / models support it; the Gateway rejects the rest with `400`.
   */
  stream?: boolean;
  /**
   * Provider-specific form fields (e.g. OpenAI `response_format`, `prompt`, `include[]`;
   * ElevenLabs `diarize`, `keyterms`, `num_speakers`), forwarded as sent under the exact
   * key given. Arrays become repeated form parts; `Blob` / `File` and binary data
   * (`ArrayBuffer`, typed arrays, Node `Buffer`) are sent as file parts; `Date` as an
   * ISO string; other objects are JSON-encoded; everything else is stringified;
   * `undefined` / `null` are skipped. See the provider's native API for the available fields.
   */
  [key: string]: unknown;
}

/** Audio bytes accepted for `file`: a `Blob` / `File`, an `ArrayBuffer`, or a typed array / Node `Buffer`. */
export type TranscriptionAudioInput = Blob | ArrayBuffer | ArrayBufferView;

/** Audio supplied as an upload. */
export interface TranscriptionFileSource {
  /**
   * The audio or video to transcribe. A `File` keeps its own name; for a plain
   * `Blob` or raw bytes set `filename` so the provider can detect the format from its extension.
   */
  file: TranscriptionAudioInput;
  /**
   * Filename for the multipart `file` part (e.g. `"meeting.mp3"`). Not sent as a
   * form field. Defaults to the `File`'s own name, otherwise `"audio"`.
   */
  filename?: string;
  source_url?: never;
}

/** Audio supplied as a URL the provider downloads (only providers that support it). */
export interface TranscriptionUrlSource {
  /** `https` URL of hosted audio or video. */
  source_url: string;
  file?: never;
  filename?: never;
}

/**
 * Request body for `TranscriptionClient.create()`. `model` is required, plus
 * exactly one of `file` or `source_url`.
 */
export type CreateTranscriptionRequest = TranscriptionRequestBase & (TranscriptionFileSource | TranscriptionUrlSource);

/**
 * The provider's JSON response, unchanged. Its shape depends on the provider, the
 * model and the provider-specific options — pass your own type to `create<T>()`
 * to narrow it.
 */
export type TranscriptionResponse = Record<string, unknown>;

/**
 * Options for `createTranscriptionClient`.
 * Accepts either `baseURL` or `env: 'production'` — the same convention used by
 * `createGatewayProvider` and the other typed clients.
 */
export type GatewayTranscriptionClientOptions = GatewayProviderSettings;

/** Per-call options for `TranscriptionClient.create()`. */
export interface TranscriptionRequestOptions {
  /** Cancels the upload / transcription when aborted (combined with the client timeout). */
  signal?: AbortSignal;
}

/**
 * Default request timeout for transcription (10 minutes) — uploads can reach
 * 512 MB and long audio takes a while to transcribe. Override with `timeout`.
 */
export const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 600_000;

/** Public interface returned by `createTranscriptionClient`. */
export interface TranscriptionClient {
  /**
   * Streaming transcription. Returns the raw `Response` so callers can read
   * `.body` as `text/event-stream` in the provider's own event format.
   */
  create(
    request: CreateTranscriptionRequest & { stream: true },
    options?: TranscriptionRequestOptions,
  ): Promise<Response>;
  /**
   * Transcribe audio and return the provider's response, unchanged: parsed JSON,
   * or the body as a `string` when the Gateway answers with `text/plain`
   * (e.g. OpenAI `response_format: 'srt'`). The default result type is
   * `TranscriptionResponse | string`, so narrow it — or pass `T` (e.g.
   * `create<string>()`, `create<{ text: string }>()`) to name the shape you expect.
   */
  create<T = TranscriptionResponse | string>(
    request: CreateTranscriptionRequest & { stream?: false },
    options?: TranscriptionRequestOptions,
  ): Promise<T>;
  /**
   * `stream` known only at runtime (a `boolean` variable): the result may be a
   * raw streaming `Response`, parsed JSON, or a `string`.
   */
  create(
    request: CreateTranscriptionRequest,
    options?: TranscriptionRequestOptions,
  ): Promise<TranscriptionResponse | string | Response>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBinary(value: unknown): value is ArrayBuffer | ArrayBufferView {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

/** Blob as-is; `ArrayBuffer` / typed array / Node `Buffer` wrapped in a Blob; anything else `undefined`. */
function toBlob(value: unknown): Blob | undefined {
  if (typeof Blob === 'undefined') return undefined;
  if (value instanceof Blob) return value;
  if (isBinary(value)) return new Blob([value as BlobPart]);
  return undefined;
}

function appendFormValue(form: FormData, key: string, value: unknown): void {
  // Binary values are sent as file parts; JSON-encoding them would yield "{}" or a byte-index object.
  const blob = toBlob(value);
  if (blob) {
    form.append(key, blob);
  } else if (typeof value === 'string') {
    form.append(key, value);
  } else if (value instanceof Date) {
    form.append(key, value.toISOString());
  } else if (typeof value === 'object') {
    form.append(key, JSON.stringify(value));
  } else {
    form.append(key, String(value));
  }
}

function buildTranscriptionFormData(request: CreateTranscriptionRequest): FormData {
  const { file, filename, ...fields } = request;
  const form = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) appendFormValue(form, key, item);
    } else {
      appendFormValue(form, key, value);
    }
  }

  // `null` is treated like an absent file, the same as every other field.
  if (file !== undefined && file !== null) {
    const blob = toBlob(file);
    if (!blob) {
      throw new TypeError(
        'createTranscriptionClient: `file` must be a Blob, File, ArrayBuffer, typed array or Buffer ' +
          `(got ${Object.prototype.toString.call(file)}).`,
      );
    }
    const ownName = typeof (file as { name?: unknown }).name === 'string' ? (file as File).name : undefined;
    form.append('file', blob, filename ?? (ownName || 'audio'));
  }

  return form;
}

/**
 * The pipeline keeps a `Content-Type` configured in `headers`; for a FormData body
 * that would replace the `multipart/form-data; boundary=…` header fetch generates.
 */
function withoutContentType(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return headers;
  return Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'content-type'));
}

function hasContentType(response: Response, mediaType: string): boolean {
  return (response.headers.get('content-type') ?? '').toLowerCase().includes(mediaType);
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a `TranscriptionClient` that talks to the AI Gateway
 * `POST /v2/audio/transcriptions` endpoint.
 *
 * The request timeout defaults to `DEFAULT_TRANSCRIPTION_TIMEOUT_MS` (10 minutes)
 * instead of the SDK-wide 60 s, since `create()` never retries and a timed-out call
 * may still be billed. Pass `timeout` to change it, or a `signal` per call to cancel.
 *
 * @example
 * ```ts
 * const transcriptions = createTranscriptionClient({
 *   env: 'production',
 *   getAuthToken: () => Promise.resolve(myJwt),
 * });
 *
 * const result = await transcriptions.create<{ text: string }>({
 *   model: 'openai/gpt-4o-transcribe',
 *   file: new File([audioBytes], 'meeting.mp3', { type: 'audio/mpeg' }),
 *   language: 'en',
 * });
 *
 * // Provider-specific fields are passed through under their native names:
 * const transcript = await transcriptions.create({
 *   model: 'elevenlabs/scribe_v2',
 *   source_url: 'https://cdn.example.com/audio/meeting.mp3',
 *   diarize: true,
 *   keyterms: ['MacPaw', 'CleanMyMac'],
 * });
 * ```
 */
export function createTranscriptionClient(options: GatewayTranscriptionClientOptions): TranscriptionClient {
  const resolvedBaseURL = resolveGatewayBaseURL(options.baseURL, options.env, 'createTranscriptionClient');
  const base = resolvedBaseURL.replace(/\/$/, '');
  const resolvedConfig = resolveConfig({
    ...options,
    baseURL: resolvedBaseURL,
    timeout: options.timeout ?? DEFAULT_TRANSCRIPTION_TIMEOUT_MS,
  });
  // POST create() is non-idempotent: retrying on 5xx risks duplicate provider-side
  // transcription (and duplicate credit charges). Auth retry (401 → fresh token)
  // is still handled at the behavior level — FormData bodies can be re-sent.
  // A configured Content-Type is dropped so fetch can set the multipart boundary.
  const requestConfig = {
    ...resolvedConfig,
    retry: false as const,
    headers: withoutContentType(resolvedConfig.headers),
  };

  const pipelineOptions = {
    includeAuth: true,
    normalizeErrors: true,
    allowAuthRetry: true,
  };

  async function create(
    request: CreateTranscriptionRequest,
    requestOptions?: TranscriptionRequestOptions,
  ): Promise<unknown> {
    const response = await executeRequestPipeline(
      requestConfig,
      {
        url: `${base}/v2/audio/transcriptions`,
        method: 'POST',
        body: buildTranscriptionFormData(request),
        signal: requestOptions?.signal,
      },
      pipelineOptions,
    );

    // Decide by what came back, not only by the request flag: a stream requested
    // any other way (e.g. `stream: 'true'` from untyped config) must not be parsed as JSON.
    if (request.stream === true || hasContentType(response, 'text/event-stream')) return response;
    if (hasContentType(response, 'text/plain')) return response.text();

    try {
      return await response.json();
    } catch (err) {
      throw new AIGatewayError(
        'Failed to parse transcription response as JSON',
        ErrorCode.InternalServerError,
        response.status,
        {},
        { cause: err },
      );
    }
  }

  return { create } as TranscriptionClient;
}
