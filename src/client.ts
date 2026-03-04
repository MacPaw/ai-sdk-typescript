/**
 * AI Gateway client: config resolution, API facades, and middleware registration.
 */

import type { AIGatewayClientConfig, Middleware, ResolvedConfig } from './core/config';
import { resolveConfig, DEFAULT_BASE_URLS } from './core/config';
import * as chatApi from './api/chat';
import * as responsesApi from './api/responses';
import * as embeddingsApi from './api/embeddings';
import * as modelsApi from './api/models';
import * as imagesApi from './api/images';
import * as audioApi from './api/audio';
import { createStreamTextResult, createStreamResponseResult } from './core/stream-result';
import type { StreamTextResult, StreamResponseResult } from './core/stream-result';
import { anySignal } from './core/abort';
import type {
  CreateChatCompletionRequest,
  ChatCompletion,
  ChatCompletionChunk,
  CreateResponseRequest,
  ResponseObject,
  ResponseStreamEvent,
  CreateEmbeddingRequest,
  CreateEmbeddingResponse,
  ModelInfoResponse,
  CreateImageRequest,
  CreateImageResponse,
  CreateImageEditRequest,
  CreateTranscriptionRequest,
  TranscriptionResponse,
  TranscriptionStreamEvent,
  CreateTranslationRequest,
  TranslationResponse,
  RequestOptions,
  WithResponseResult,
} from './core/types';

/**
 * Chat completions API — OpenAI-compatible chat endpoint.
 *
 * @example
 * ```ts
 * // Non-streaming
 * const completion = await client.chat.completions.create({
 *   model: 'openai/gpt-4.1-nano',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 *
 * // Streaming
 * for await (const chunk of client.chat.completions.create({
 *   model: 'openai/gpt-4.1-nano',
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   stream: true,
 * })) {
 *   process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
 * }
 *
 * // Rich stream with text promise and abort
 * const result = client.chat.completions.stream({
 *   model: 'openai/gpt-4.1-nano',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * for await (const delta of result.textStream) process.stdout.write(delta);
 * const fullText = await result.text;
 * const usage = await result.usage;
 * ```
 */
export interface ChatCompletionsAPI {
  /** Create a streaming chat completion. Returns an async iterator of chunks. */
  create(request: CreateChatCompletionRequest & { stream: true }, options?: RequestOptions): AsyncIterableIterator<ChatCompletionChunk>;
  /** Create a non-streaming chat completion with response headers access. */
  create(request: CreateChatCompletionRequest & { stream?: false | undefined }, options: RequestOptions & { withResponse: true }): Promise<WithResponseResult<ChatCompletion>>;
  /** Create a non-streaming chat completion. */
  create(request: CreateChatCompletionRequest & { stream?: false | undefined }, options?: RequestOptions): Promise<ChatCompletion>;
  create(request: CreateChatCompletionRequest, options?: RequestOptions): Promise<ChatCompletion> | AsyncIterableIterator<ChatCompletionChunk>;
  /**
   * Start a streaming chat completion and return a rich result object
   * with `textStream`, `text`, `usage`, and `abort()`.
   */
  stream(request: Omit<CreateChatCompletionRequest, 'stream'>, options?: RequestOptions): StreamTextResult;
}

/**
 * Responses API — OpenAI Create Response format.
 *
 * @example
 * ```ts
 * const response = await client.responses.create({
 *   model: 'openai/gpt-4.1-nano',
 *   input: 'Explain TypeScript generics.',
 * });
 *
 * // Rich streaming
 * const result = client.responses.stream({
 *   model: 'openai/gpt-4.1-nano',
 *   input: 'Hello',
 * });
 * for await (const delta of result.textStream) process.stdout.write(delta);
 * ```
 */
export interface ResponsesAPI {
  /** Create a response with response headers access. */
  create(request: CreateResponseRequest, options: RequestOptions & { withResponse: true }): Promise<WithResponseResult<ResponseObject>>;
  /** Create a response (non-streaming). */
  create(request: CreateResponseRequest, options?: RequestOptions): Promise<ResponseObject>;
  /** Create a streaming response. Returns a raw async generator. */
  createStream(request: CreateResponseRequest, options?: RequestOptions): AsyncGenerator<ResponseStreamEvent, void, undefined>;
  /**
   * Start a streaming response and return a rich result object
   * with `textStream`, `text`, `usage`, and `abort()`.
   */
  stream(request: Omit<CreateResponseRequest, 'stream'>, options?: RequestOptions): StreamResponseResult;
}

/**
 * Embeddings API.
 *
 * @example
 * ```ts
 * const result = await client.embeddings.create({
 *   model: 'text-embedding-3-small',
 *   input: 'Hello world',
 * });
 * console.log(result.data[0].embedding);
 * ```
 */
export interface EmbeddingsAPI {
  create(request: CreateEmbeddingRequest, options: RequestOptions & { withResponse: true }): Promise<WithResponseResult<CreateEmbeddingResponse>>;
  /** Create embeddings for the given input. */
  create(request: CreateEmbeddingRequest, options?: RequestOptions): Promise<CreateEmbeddingResponse>;
}

/**
 * Models API — query available model metadata.
 *
 * @example
 * ```ts
 * const info = await client.models.getInfo();
 * for (const entry of info.data) {
 *   console.log(entry.model_name, entry.model_info.mode);
 * }
 * ```
 */
export interface ModelsAPI {
  getInfo(params?: { litellm_model_id?: string }, options?: RequestOptions & { withResponse: true }): Promise<WithResponseResult<ModelInfoResponse>>;
  /** Get information about available models. Optionally filter by `litellm_model_id`. */
  getInfo(params?: { litellm_model_id?: string }, options?: RequestOptions): Promise<ModelInfoResponse>;
}

/**
 * Images API — generation and editing.
 *
 * @example
 * ```ts
 * const result = await client.images.generate({
 *   prompt: 'A serene mountain landscape',
 *   model: 'dall-e-3',
 *   size: '1024x1024',
 * });
 * console.log(result.data[0].url);
 * ```
 */
export interface ImagesAPI {
  generate(request: CreateImageRequest, options: RequestOptions & { withResponse: true }): Promise<WithResponseResult<CreateImageResponse>>;
  /** Generate images from a text prompt. */
  generate(request: CreateImageRequest, options?: RequestOptions): Promise<CreateImageResponse>;
  edit(request: CreateImageEditRequest, options: RequestOptions & { withResponse: true }): Promise<WithResponseResult<CreateImageResponse>>;
  /** Edit an existing image using a prompt and optional mask. Uploads via multipart/form-data. */
  edit(request: CreateImageEditRequest, options?: RequestOptions): Promise<CreateImageResponse>;
}

/**
 * Audio transcriptions API — speech-to-text.
 *
 * @example
 * ```ts
 * const result = await client.audio.transcriptions.create({
 *   file: audioBlob,
 *   model: 'whisper-1',
 * });
 * console.log(result.text);
 * ```
 */
export interface AudioTranscriptionsAPI {
  /** Create a streaming transcription. */
  create(request: CreateTranscriptionRequest & { stream: true }, options?: RequestOptions): AsyncGenerator<TranscriptionStreamEvent, void, undefined>;
  create(request: CreateTranscriptionRequest & { stream?: false | undefined }, options: RequestOptions & { withResponse: true }): Promise<WithResponseResult<TranscriptionResponse>>;
  /** Create a transcription from an audio file. */
  create(request: CreateTranscriptionRequest & { stream?: false | undefined }, options?: RequestOptions): Promise<TranscriptionResponse>;
  create(request: CreateTranscriptionRequest, options?: RequestOptions): Promise<TranscriptionResponse> | AsyncGenerator<TranscriptionStreamEvent, void, undefined>;
}

/** Audio translations API — translate audio to English text. */
export interface AudioTranslationsAPI {
  create(request: CreateTranslationRequest, options: RequestOptions & { withResponse: true }): Promise<WithResponseResult<TranslationResponse>>;
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
 *
 * @example
 * ```ts
 * import { createAIGatewayClient } from '@macpaw/ai';
 *
 * const client = createAIGatewayClient({
 *   env: 'production',
 *   getAuthToken: async () => myToken,
 * });
 *
 * // Register middleware
 * client.use(async (req, next) => {
 *   console.log('Request:', req.method, req.url);
 *   return next(req);
 * });
 * ```
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

function buildChatCompletions(config: ResolvedConfig): ChatCompletionsAPI {
  function create(
    request: CreateChatCompletionRequest,
    options?: RequestOptions
  ): Promise<ChatCompletion | WithResponseResult<ChatCompletion>> | AsyncIterableIterator<ChatCompletionChunk> {
    if (request.stream) {
      return chatApi.createChatCompletionStream(config, request, options) as AsyncIterableIterator<ChatCompletionChunk>;
    }
    return chatApi.createChatCompletion(config, request, options);
  }

  function stream(
    request: Omit<CreateChatCompletionRequest, 'stream'>,
    options?: RequestOptions
  ): StreamTextResult {
    const ac = new AbortController();
    const mergedOptions: RequestOptions = {
      ...options,
      signal: options?.signal
        ? anySignal([options.signal, ac.signal])
        : ac.signal,
    };
    const fullRequest: CreateChatCompletionRequest = {
      ...(request as CreateChatCompletionRequest),
      stream: true,
      stream_options: {
        include_usage: true,
        ...((request as Record<string, unknown>).stream_options as object | undefined),
      },
    };
    const generator = chatApi.createChatCompletionStream(
      config,
      fullRequest,
      mergedOptions,
    );
    return createStreamTextResult(generator, ac);
  }

  return { create, stream } as ChatCompletionsAPI;
}

function buildResponses(config: ResolvedConfig): ResponsesAPI {
  return {
    create(request: CreateResponseRequest, options?: RequestOptions) {
      return responsesApi.createResponse(config, request, options);
    },
    createStream(request: CreateResponseRequest, options?: RequestOptions) {
      return responsesApi.createResponseStream(config, request, options);
    },
    stream(
      request: Omit<CreateResponseRequest, 'stream'>,
      options?: RequestOptions
    ): StreamResponseResult {
      const ac = new AbortController();
      const mergedOptions: RequestOptions = {
        ...options,
        signal: options?.signal
          ? anySignal([options.signal, ac.signal])
          : ac.signal,
      };
      const generator = responsesApi.createResponseStream(
        config,
        { ...request, stream: true } as CreateResponseRequest,
        mergedOptions,
      );
      return createStreamResponseResult(generator, ac);
    },
  } as ResponsesAPI;
}

function buildEmbeddings(config: ResolvedConfig): EmbeddingsAPI {
  return {
    create(request: CreateEmbeddingRequest, options?: RequestOptions) {
      return embeddingsApi.createEmbedding(config, request, options);
    },
  } as EmbeddingsAPI;
}

function buildModels(config: ResolvedConfig): ModelsAPI {
  return {
    getInfo(params?: { litellm_model_id?: string }, options?: RequestOptions) {
      return modelsApi.getModelInfo(config, params, options);
    },
  } as ModelsAPI;
}

function buildImages(config: ResolvedConfig): ImagesAPI {
  return {
    generate(request: CreateImageRequest, options?: RequestOptions) {
      return imagesApi.createImage(config, request, options);
    },
    edit(request: CreateImageEditRequest, options?: RequestOptions) {
      return imagesApi.createImageEdit(config, request, options);
    },
  } as ImagesAPI;
}

function buildAudio(config: ResolvedConfig): AudioAPI {
  function createTranscription(
    request: CreateTranscriptionRequest,
    options?: RequestOptions
  ): Promise<TranscriptionResponse | WithResponseResult<TranscriptionResponse>> | AsyncGenerator<TranscriptionStreamEvent, void, undefined> {
    if (request.stream) {
      return audioApi.createTranscriptionStream(config, request, options);
    }
    return audioApi.createTranscription(config, request, options);
  }

  return {
    transcriptions: { create: createTranscription } as AudioTranscriptionsAPI,
    translations: {
      create(request: CreateTranslationRequest, options?: RequestOptions) {
        return audioApi.createTranslation(config, request, options);
      },
    } as AudioTranslationsAPI,
  };
}

/**
 * Create an AI Gateway client instance.
 *
 * @param config - Client configuration including auth, base URL, and optional retry/middleware settings.
 * @returns A fully-configured {@link AIGatewayClient} with namespaced API access.
 *
 * @example
 * ```ts
 * const client = createAIGatewayClient({
 *   env: 'production',
 *   getAuthToken: async () => (await getSession()).accessToken,
 *   retry: { maxRetries: 3 },
 * });
 * ```
 */
export function createAIGatewayClient(config: AIGatewayClientConfig): AIGatewayClient {
  const baseURL = config.baseURL ?? (config.env ? DEFAULT_BASE_URLS[config.env] : undefined);
  if (!baseURL) {
    throw new Error('AIGatewayClient requires baseURL or env (production). For non-production environments, pass baseURL directly.');
  }
  const resolved: ResolvedConfig = resolveConfig({ ...config, baseURL });

  let _chat: { completions: ChatCompletionsAPI } | undefined;
  let _responses: ResponsesAPI | undefined;
  let _embeddings: EmbeddingsAPI | undefined;
  let _models: ModelsAPI | undefined;
  let _images: ImagesAPI | undefined;
  let _audio: AudioAPI | undefined;

  const client: AIGatewayClient = {
    get chat() {
      return (_chat ??= { completions: buildChatCompletions(resolved) });
    },
    get responses() {
      return (_responses ??= buildResponses(resolved));
    },
    get embeddings() {
      return (_embeddings ??= buildEmbeddings(resolved));
    },
    get models() {
      return (_models ??= buildModels(resolved));
    },
    get images() {
      return (_images ??= buildImages(resolved));
    },
    get audio() {
      return (_audio ??= buildAudio(resolved));
    },
    use(mw: Middleware) {
      resolved.middleware.push(mw);
    },
  };

  return client;
}
