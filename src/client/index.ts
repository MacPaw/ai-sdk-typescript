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
  TranscriptionResponse,
  TranscriptionStreamEvent,
  TranslationResponse,
  WithResponseResult,
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

function assertNonStreamingWithResponseRequest(request: { stream?: boolean }, methodName: string): void {
  if (request.stream === true) {
    throw new Error(`${methodName} does not support stream: true. Use the streaming method instead.`);
  }
}

function buildChatCompletions(config: ResolvedConfig): ChatCompletionsAPI {
  function create(
    request: CreateChatCompletionRequest,
    options?: RequestOptions,
  ): Promise<ChatCompletion> | AsyncIterableIterator<ChatCompletionChunk> {
    if (request.stream) {
      return chatApi.createChatCompletionStream(config, request, options) as AsyncIterableIterator<ChatCompletionChunk>;
    }
    return chatApi.createChatCompletion(config, request, options) as Promise<ChatCompletion>;
  }

  function createWithResponse(
    request: CreateChatCompletionRequest & { stream?: false | undefined },
    options?: RequestOptions,
  ): Promise<WithResponseResult<ChatCompletion>> {
    assertNonStreamingWithResponseRequest(request, 'chat.completions.createWithResponse');
    return chatApi.createChatCompletion(config, request, { ...options, withResponse: true }) as Promise<
      WithResponseResult<ChatCompletion>
    >;
  }

  function stream(request: Omit<CreateChatCompletionRequest, 'stream'>, options?: RequestOptions): StreamTextResult {
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
  }

  // `as` cast required: TS cannot unify a union return type with overloaded signatures.
  // Safety is ensured by the explicit ChatCompletionsAPI return type on buildChatCompletions.
  return { create, createWithResponse, stream } as ChatCompletionsAPI;
}

function buildResponses(config: ResolvedConfig): ResponsesAPI {
  return {
    create(request: CreateResponseRequest, options?: RequestOptions) {
      return responsesApi.createResponse(config, request, options) as Promise<ResponseObject>;
    },
    createWithResponse(request: CreateResponseRequest, options?: RequestOptions) {
      assertNonStreamingWithResponseRequest(request, 'responses.createWithResponse');
      return responsesApi.createResponse(config, request, { ...options, withResponse: true }) as Promise<
        WithResponseResult<ResponseObject>
      >;
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
  } as ResponsesAPI;
}

function buildEmbeddings(config: ResolvedConfig): EmbeddingsAPI {
  return {
    create(request: CreateEmbeddingRequest, options?: RequestOptions) {
      return embeddingsApi.createEmbedding(config, request, options) as Promise<CreateEmbeddingResponse>;
    },
    createWithResponse(request: CreateEmbeddingRequest, options?: RequestOptions) {
      return embeddingsApi.createEmbedding(config, request, { ...options, withResponse: true }) as Promise<
        WithResponseResult<CreateEmbeddingResponse>
      >;
    },
  } as EmbeddingsAPI;
}

function buildModels(config: ResolvedConfig): ModelsAPI {
  return {
    getInfo(params?: { litellm_model_id?: string }, options?: RequestOptions) {
      return modelsApi.getModelInfo(config, params, options) as Promise<ModelInfoResponse>;
    },
    getInfoWithResponse(params?: { litellm_model_id?: string }, options?: RequestOptions) {
      return modelsApi.getModelInfo(config, params, { ...options, withResponse: true }) as Promise<
        WithResponseResult<ModelInfoResponse>
      >;
    },
  } as ModelsAPI;
}

function buildImages(config: ResolvedConfig): ImagesAPI {
  return {
    generate(request: CreateImageRequest, options?: RequestOptions) {
      return imagesApi.createImage(config, request, options) as Promise<CreateImageResponse>;
    },
    generateWithResponse(request: CreateImageRequest, options?: RequestOptions) {
      return imagesApi.createImage(config, request, { ...options, withResponse: true }) as Promise<
        WithResponseResult<CreateImageResponse>
      >;
    },
    edit(request: CreateImageEditRequest, options?: RequestOptions) {
      return imagesApi.createImageEdit(config, request, options) as Promise<CreateImageResponse>;
    },
    editWithResponse(request: CreateImageEditRequest, options?: RequestOptions) {
      return imagesApi.createImageEdit(config, request, { ...options, withResponse: true }) as Promise<
        WithResponseResult<CreateImageResponse>
      >;
    },
  } as ImagesAPI;
}

function buildAudio(config: ResolvedConfig): AudioAPI {
  function createTranscription(
    request: CreateTranscriptionRequest,
    options?: RequestOptions,
  ): Promise<TranscriptionResponse> | AsyncGenerator<TranscriptionStreamEvent, void, undefined> {
    if (request.stream) {
      return audioApi.createTranscriptionStream(config, request, options);
    }
    return audioApi.createTranscription(config, request, options) as Promise<TranscriptionResponse>;
  }

  function createTranscriptionWithResponse(
    request: CreateTranscriptionRequest & { stream?: false | undefined },
    options?: RequestOptions,
  ): Promise<WithResponseResult<TranscriptionResponse>> {
    assertNonStreamingWithResponseRequest(request, 'audio.transcriptions.createWithResponse');
    return audioApi.createTranscription(config, request, { ...options, withResponse: true }) as Promise<
      WithResponseResult<TranscriptionResponse>
    >;
  }

  return {
    transcriptions: { create: createTranscription, createWithResponse: createTranscriptionWithResponse } as AudioTranscriptionsAPI,
    translations: {
      create(request: CreateTranslationRequest, options?: RequestOptions) {
        return audioApi.createTranslation(config, request, options) as Promise<TranslationResponse>;
      },
      createWithResponse(request: CreateTranslationRequest, options?: RequestOptions) {
        return audioApi.createTranslation(config, request, { ...options, withResponse: true }) as Promise<
          WithResponseResult<TranslationResponse>
        >;
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
