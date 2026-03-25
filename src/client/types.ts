/**
 * AI Gateway HTTP client API surface types.
 * Domain request/response types are imported from `@macpaw/ai-sdk/types` — not re-exported here.
 */
import type { Middleware } from '../runtime/config';
import type { StreamTextResult, StreamResponseResult } from '../runtime/stream-result';
import type {
  ChatCompletion,
  ChatCompletionChunk,
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
  WithResponseResult,
} from '../types';

/**
 * Chat completions API — OpenAI-compatible chat endpoint.
 */
export interface ChatCompletionsAPI {
  /** Create a streaming chat completion. Returns an async iterator of chunks. */
  create(
    request: CreateChatCompletionRequest & { stream: true },
    options?: RequestOptions,
  ): AsyncIterableIterator<ChatCompletionChunk>;
  /** Create a non-streaming chat completion with response headers access. */
  create(
    request: CreateChatCompletionRequest & { stream?: false | undefined },
    options: RequestOptions & { withResponse: true },
  ): Promise<WithResponseResult<ChatCompletion>>;
  /** Create a non-streaming chat completion. */
  create(
    request: CreateChatCompletionRequest & { stream?: false | undefined },
    options?: RequestOptions,
  ): Promise<ChatCompletion>;
  create(
    request: CreateChatCompletionRequest,
    options?: RequestOptions,
  ): Promise<ChatCompletion> | AsyncIterableIterator<ChatCompletionChunk>;
  /**
   * Start a streaming chat completion and return a rich result object
   * with `textStream`, `text`, `usage`, and `abort()`.
   */
  stream(request: Omit<CreateChatCompletionRequest, 'stream'>, options?: RequestOptions): StreamTextResult;
}

/**
 * Responses API — OpenAI Create Response format.
 */
export interface ResponsesAPI {
  /** Create a response with response headers access. */
  create(
    request: CreateResponseRequest,
    options: RequestOptions & { withResponse: true },
  ): Promise<WithResponseResult<ResponseObject>>;
  /** Create a response (non-streaming). */
  create(request: CreateResponseRequest, options?: RequestOptions): Promise<ResponseObject>;
  /** Create a streaming response. Returns a raw async generator. */
  createStream(
    request: CreateResponseRequest,
    options?: RequestOptions,
  ): AsyncGenerator<ResponseStreamEvent, void, undefined>;
  /**
   * Start a streaming response and return a rich result object
   * with `textStream`, `text`, `usage`, and `abort()`.
   */
  stream(request: Omit<CreateResponseRequest, 'stream'>, options?: RequestOptions): StreamResponseResult;
}

/** Embeddings API. */
export interface EmbeddingsAPI {
  create(
    request: CreateEmbeddingRequest,
    options: RequestOptions & { withResponse: true },
  ): Promise<WithResponseResult<CreateEmbeddingResponse>>;
  /** Create embeddings for the given input. */
  create(request: CreateEmbeddingRequest, options?: RequestOptions): Promise<CreateEmbeddingResponse>;
}

/** Models API — query available model metadata. */
export interface ModelsAPI {
  getInfo(
    params: { litellm_model_id?: string } | undefined,
    options: RequestOptions & { withResponse: true },
  ): Promise<WithResponseResult<ModelInfoResponse>>;
  /** Get information about available models. Optionally filter by `litellm_model_id`. */
  getInfo(params?: { litellm_model_id?: string }, options?: RequestOptions): Promise<ModelInfoResponse>;
}

/** Images API — generation and editing. */
export interface ImagesAPI {
  generate(
    request: CreateImageRequest,
    options: RequestOptions & { withResponse: true },
  ): Promise<WithResponseResult<CreateImageResponse>>;
  /** Generate images from a text prompt. */
  generate(request: CreateImageRequest, options?: RequestOptions): Promise<CreateImageResponse>;
  edit(
    request: CreateImageEditRequest,
    options: RequestOptions & { withResponse: true },
  ): Promise<WithResponseResult<CreateImageResponse>>;
  /** Edit an existing image using a prompt and optional mask. Uploads via multipart/form-data. */
  edit(request: CreateImageEditRequest, options?: RequestOptions): Promise<CreateImageResponse>;
}

/** Audio transcriptions API — speech-to-text. */
export interface AudioTranscriptionsAPI {
  /** Create a streaming transcription. */
  create(
    request: CreateTranscriptionRequest & { stream: true },
    options?: RequestOptions,
  ): AsyncGenerator<TranscriptionStreamEvent, void, undefined>;
  create(
    request: CreateTranscriptionRequest & { stream?: false | undefined },
    options: RequestOptions & { withResponse: true },
  ): Promise<WithResponseResult<TranscriptionResponse>>;
  /** Create a transcription from an audio file. */
  create(
    request: CreateTranscriptionRequest & { stream?: false | undefined },
    options?: RequestOptions,
  ): Promise<TranscriptionResponse>;
  create(
    request: CreateTranscriptionRequest,
    options?: RequestOptions,
  ): Promise<TranscriptionResponse> | AsyncGenerator<TranscriptionStreamEvent, void, undefined>;
}

/** Audio translations API — translate audio to English text. */
export interface AudioTranslationsAPI {
  create(
    request: CreateTranslationRequest,
    options: RequestOptions & { withResponse: true },
  ): Promise<WithResponseResult<TranslationResponse>>;
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
