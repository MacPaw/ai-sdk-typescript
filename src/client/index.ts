/**
 * AI Gateway client: config resolution, API facades, and middleware registration.
 */

import type { AIGatewayClientConfig, Middleware, ResolvedConfig } from '../runtime/config';
import { resolveConfig, resolveGatewayBaseURL } from '../runtime/config';
import * as chatApi from './api/chat';
import * as responsesApi from './api/responses';
import * as embeddingsApi from './api/embeddings';
import * as modelsApi from './api/models';
import * as imagesApi from './api/images';
import * as audioApi from './api/audio';
import { createStreamTextResult, createStreamResponseResult } from '../runtime/stream-result';
import type { StreamTextResult, StreamResponseResult } from '../runtime/stream-result';
import { anySignal } from '../runtime/abort';
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
  TranscriptionResponse,
  TranscriptionStreamEvent,
  TranslationResponse,
} from '../types';
import type {
  AIGatewayClient,
  AudioAPI,
  AudioTranscriptionsAPI,
  AudioTranslationsAPI,
  ChatCompletionsAPI,
  EmbeddingsAPI,
  ImagesAPI,
  ModelsAPI,
  ResponsesAPI,
} from './types';

/** Public client surface types — request/response DTOs live in `@macpaw/ai-sdk/types`. */
export type * from './types';

function buildChatCompletions(config: ResolvedConfig): ChatCompletionsAPI {
  return {
    create(request: CreateChatCompletionRequest, options?: RequestOptions): Promise<ChatCompletion> {
      return chatApi.createChatCompletion(config, request, options);
    },
    stream(request: Omit<CreateChatCompletionRequest, 'stream'>, options?: RequestOptions): StreamTextResult {
      const ac = new AbortController();
      const mergedOptions: RequestOptions = {
        ...options,
        signal: options?.signal ? anySignal([options.signal, ac.signal]) : ac.signal,
      };
      const fullRequest: CreateChatCompletionRequest = {
        ...(request as CreateChatCompletionRequest),
        stream: true,
        stream_options: {
          include_usage: true,
          ...((request as Record<string, unknown>).stream_options as object | undefined),
        },
      };
      const generator = chatApi.createChatCompletionStream(config, fullRequest, mergedOptions);
      return createStreamTextResult(generator, ac);
    },
  };
}

function buildResponses(config: ResolvedConfig): ResponsesAPI {
  return {
    create(request: CreateResponseRequest, options?: RequestOptions): Promise<ResponseObject> {
      return responsesApi.createResponse(config, request, options);
    },
    createStream(request: CreateResponseRequest, options?: RequestOptions) {
      return responsesApi.createResponseStream(config, request, options);
    },
    stream(request: Omit<CreateResponseRequest, 'stream'>, options?: RequestOptions): StreamResponseResult {
      const ac = new AbortController();
      const mergedOptions: RequestOptions = {
        ...options,
        signal: options?.signal ? anySignal([options.signal, ac.signal]) : ac.signal,
      };
      const generator = responsesApi.createResponseStream(
        config,
        { ...request, stream: true } as CreateResponseRequest,
        mergedOptions,
      );
      return createStreamResponseResult(generator, ac);
    },
  };
}

function buildEmbeddings(config: ResolvedConfig): EmbeddingsAPI {
  return {
    create(request: CreateEmbeddingRequest, options?: RequestOptions): Promise<CreateEmbeddingResponse> {
      return embeddingsApi.createEmbedding(config, request, options);
    },
  };
}

function buildModels(config: ResolvedConfig): ModelsAPI {
  return {
    getInfo(params?: { litellm_model_id?: string }, options?: RequestOptions): Promise<ModelInfoResponse> {
      return modelsApi.getModelInfo(config, params, options);
    },
  };
}

function buildImages(config: ResolvedConfig): ImagesAPI {
  return {
    generate(request: CreateImageRequest, options?: RequestOptions): Promise<CreateImageResponse> {
      return imagesApi.createImage(config, request, options);
    },
    edit(request: CreateImageEditRequest, options?: RequestOptions): Promise<CreateImageResponse> {
      return imagesApi.createImageEdit(config, request, options);
    },
  };
}

function buildAudio(config: ResolvedConfig): AudioAPI {
  const transcriptions: AudioTranscriptionsAPI = {
    create(request: CreateTranscriptionRequest, options?: RequestOptions): Promise<TranscriptionResponse> {
      return audioApi.createTranscription(config, request, options);
    },
    stream(
      request: Omit<CreateTranscriptionRequest, 'stream'>,
      options?: RequestOptions,
    ): AsyncGenerator<TranscriptionStreamEvent, void, undefined> {
      return audioApi.createTranscriptionStream(config, request as CreateTranscriptionRequest, options);
    },
  };

  const translations: AudioTranslationsAPI = {
    create(request: CreateTranslationRequest, options?: RequestOptions): Promise<TranslationResponse> {
      return audioApi.createTranslation(config, request, options);
    },
  };

  return { transcriptions, translations };
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
 *   retry: { maxAttempts: 3 },
 * });
 * ```
 */
export function createAIGatewayClient(config: AIGatewayClientConfig): AIGatewayClient {
  const baseURL = resolveGatewayBaseURL(config.baseURL, config.env, 'AIGatewayClient');
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
