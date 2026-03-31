/**
 * AI Gateway HTTP client API surface types.
 * Domain request/response types are imported from `@macpaw/ai-sdk/types` — not re-exported here.
 */
import type { Middleware } from '../runtime/config';
import type { StreamTextResult, StreamResponseResult } from '../runtime/stream-result';
import type {
  ChatCompletion,
  CreateChatCompletionRequest,
  CreateEmbeddingRequest,
  CreateEmbeddingResponse,
  CreateImageEditRequest,
  CreateImageRequest,
  CreateImageResponse,
  CreateResponseRequest,
  CreateTranscriptionRequest,
  CreateTranslationRequest,
  ModelInfoResponse,
  RequestOptions,
  ResponseObject,
  ResponseStreamEvent,
  TranscriptionResponse,
  TranscriptionStreamEvent,
  TranslationResponse,
} from '../types';

/**
 * Chat completions API — OpenAI-compatible chat endpoint.
 */
export interface ChatCompletionsAPI {
  /** Create a non-streaming chat completion. */
  create(request: CreateChatCompletionRequest, options?: RequestOptions): Promise<ChatCompletion>;
  /**
   * Start a streaming chat completion and return a rich result object
   * with a single-consumer `stream`/`textStream` view, plus `text`, `usage`, and `abort()`.
   */
  stream(request: Omit<CreateChatCompletionRequest, 'stream'>, options?: RequestOptions): StreamTextResult;
}

/**
 * Responses API — OpenAI Create Response format.
 */
export interface ResponsesAPI {
  /** Create a response (non-streaming). */
  create(request: CreateResponseRequest, options?: RequestOptions): Promise<ResponseObject>;
  /** Create a streaming response. Returns a raw async generator (for BFF event forwarding). */
  createStream(
    request: CreateResponseRequest,
    options?: RequestOptions,
  ): AsyncGenerator<ResponseStreamEvent, void, undefined>;
  /**
   * Start a streaming response and return a rich result object
   * with a single-consumer `stream`/`textStream` view, plus `text`, `usage`, and `abort()`.
   */
  stream(request: Omit<CreateResponseRequest, 'stream'>, options?: RequestOptions): StreamResponseResult;
}

/** Embeddings API. */
export interface EmbeddingsAPI {
  /** Create embeddings for the given input. */
  create(request: CreateEmbeddingRequest, options?: RequestOptions): Promise<CreateEmbeddingResponse>;
}

/** Models API — query available model metadata. */
export interface ModelsAPI {
  /** Get information about available models. Optionally filter by `litellm_model_id`. */
  getInfo(params?: { litellm_model_id?: string }, options?: RequestOptions): Promise<ModelInfoResponse>;
}

/** Images API — generation and editing. */
export interface ImagesAPI {
  /** Generate images from a text prompt. */
  generate(request: CreateImageRequest, options?: RequestOptions): Promise<CreateImageResponse>;
  /** Edit an existing image using a prompt and optional mask. Uploads via multipart/form-data. */
  edit(request: CreateImageEditRequest, options?: RequestOptions): Promise<CreateImageResponse>;
}

/** Audio transcriptions API — speech-to-text. */
export interface AudioTranscriptionsAPI {
  /** Create a transcription from an audio file. */
  create(request: CreateTranscriptionRequest, options?: RequestOptions): Promise<TranscriptionResponse>;
  /** Stream transcription results as async generator of events. */
  stream(
    request: Omit<CreateTranscriptionRequest, 'stream'>,
    options?: RequestOptions,
  ): AsyncGenerator<TranscriptionStreamEvent, void, undefined>;
}

/** Audio translations API — translate audio to English text. */
export interface AudioTranslationsAPI {
  /** Translate audio to English. */
  create(request: CreateTranslationRequest, options?: RequestOptions): Promise<TranslationResponse>;
}

/** Audio API namespace grouping transcriptions and translations. */
export interface AudioAPI {
  transcriptions: AudioTranscriptionsAPI;
  translations: AudioTranslationsAPI;
}

/**
 * The main AI Gateway client. Provides namespaced API access, middleware registration,
 * and handles authentication, retries, and error normalization.
 */
export interface AIGatewayClient {
  /** Chat completions API (OpenAI-compatible). */
  readonly chat: { completions: ChatCompletionsAPI };
  /** Responses API (OpenAI Create Response format). */
  readonly responses: ResponsesAPI;
  /** Embeddings API. */
  readonly embeddings: EmbeddingsAPI;
  /** Models metadata API. */
  readonly models: ModelsAPI;
  /** Images generation and editing API. */
  readonly images: ImagesAPI;
  /** Audio transcriptions and translations API. */
  readonly audio: AudioAPI;
  /** Register a middleware function in the request pipeline. */
  use(middleware: Middleware): void;
}
