/**
 * Vercel AI SDK `customProvider` wired to AI Gateway as the fallback provider.
 */

import type {
  EmbeddingModelV3,
  ImageModelV3,
  LanguageModelV3,
  ProviderV3,
  RerankingModelV3,
  SpeechModelV3,
  TranscriptionModelV3,
} from '@ai-sdk/provider';
import { customProvider } from 'ai';
import { resolveAIGatewayProvider } from './provider-source';
import type { AIGatewayProviderSource } from './provider-source';

/**
 * Maps ProviderV3 method names to OpenAIProvider method names where they differ.
 * Updated when `@ai-sdk/openai` renames methods relative to the generic ProviderV3 interface.
 */
const OPENAI_METHOD_MAP: Record<string, string> = {
  transcriptionModel: 'transcription',
  speechModel: 'speech',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function delegateToProvider(provider: ProviderV3, method: string, modelId: string): any {
  const mapped = OPENAI_METHOD_MAP[method] ?? method;
  const target = provider as unknown as Record<string, unknown>;

  const fn = target[mapped];
  if (typeof fn === 'function') {
    return fn.call(provider, modelId);
  }

  const directFn = target[method];
  if (typeof directFn === 'function') {
    return directFn.call(provider, modelId);
  }

  throw new Error(`AI Gateway fallback provider does not implement ${method}() or ${mapped}()`);
}

export interface AIGatewayCustomProviderRegistry<
  LANGUAGE_MODELS extends Record<string, LanguageModelV3> = Record<string, never>,
  EMBEDDING_MODELS extends Record<string, EmbeddingModelV3> = Record<string, never>,
  IMAGE_MODELS extends Record<string, ImageModelV3> = Record<string, never>,
  TRANSCRIPTION_MODELS extends Record<string, TranscriptionModelV3> = Record<string, never>,
  SPEECH_MODELS extends Record<string, SpeechModelV3> = Record<string, never>,
  RERANKING_MODELS extends Record<string, RerankingModelV3> = Record<string, never>,
> {
  languageModels?: LANGUAGE_MODELS;
  embeddingModels?: EMBEDDING_MODELS;
  imageModels?: IMAGE_MODELS;
  transcriptionModels?: TRANSCRIPTION_MODELS;
  speechModels?: SPEECH_MODELS;
  rerankingModels?: RERANKING_MODELS;
}

/**
 * Builds a {@link customProvider} whose `fallbackProvider` is an AI Gateway OpenAI-compatible
 * provider from {@link resolveAIGatewayProvider}. Use `languageModels`, `embeddingModels`, etc.
 * to register aliases or restrict models; unknown IDs resolve through the gateway fallback.
 * The gateway source can be passed eagerly or lazily and is resolved only when the
 * fallback branch is first used.
 *
 * @example
 * ```ts
 * import { generateText } from 'ai';
 * import { createAIGatewayProvider, createAIGatewayCustomProvider } from '@macpaw/ai-sdk/provider';
 *
 * const gateway = createAIGatewayProvider({
 *   getAuthToken: async () => token,
 *   env: 'production',
 * });
 *
 * const registry = createAIGatewayCustomProvider(gateway, {
 *   languageModels: {
 *     fast: gateway('openai/gpt-4.1-nano'),
 *   },
 * });
 *
 * await generateText({ model: registry.languageModel('fast'), prompt: 'Hi' });
 * ```
 */
export function createAIGatewayCustomProvider<
  LANGUAGE_MODELS extends Record<string, LanguageModelV3> = Record<string, never>,
  EMBEDDING_MODELS extends Record<string, EmbeddingModelV3> = Record<string, never>,
  IMAGE_MODELS extends Record<string, ImageModelV3> = Record<string, never>,
  TRANSCRIPTION_MODELS extends Record<string, TranscriptionModelV3> = Record<string, never>,
  SPEECH_MODELS extends Record<string, SpeechModelV3> = Record<string, never>,
  RERANKING_MODELS extends Record<string, RerankingModelV3> = Record<string, never>,
>(
  gateway: AIGatewayProviderSource,
  registry: AIGatewayCustomProviderRegistry<
    LANGUAGE_MODELS,
    EMBEDDING_MODELS,
    IMAGE_MODELS,
    TRANSCRIPTION_MODELS,
    SPEECH_MODELS,
    RERANKING_MODELS
  >,
): ProviderV3 & {
  languageModel(modelId: Extract<keyof LANGUAGE_MODELS, string>): LanguageModelV3;
  embeddingModel(modelId: Extract<keyof EMBEDDING_MODELS, string>): EmbeddingModelV3;
  imageModel(modelId: Extract<keyof IMAGE_MODELS, string>): ImageModelV3;
  transcriptionModel(modelId: Extract<keyof TRANSCRIPTION_MODELS, string>): TranscriptionModelV3;
  speechModel(modelId: Extract<keyof SPEECH_MODELS, string>): SpeechModelV3;
  rerankingModel(modelId: Extract<keyof RERANKING_MODELS, string>): RerankingModelV3;
} {
  let fallbackProvider: ReturnType<typeof resolveAIGatewayProvider> | undefined;
  const resolveFallbackProvider = () => (fallbackProvider ??= resolveAIGatewayProvider(gateway));

  const lazyFallbackProvider: ProviderV3 = {
    specificationVersion: 'v3',
    languageModel(modelId) {
      return resolveFallbackProvider().languageModel(modelId);
    },
    embeddingModel(modelId) {
      return resolveFallbackProvider().embeddingModel(modelId);
    },
    imageModel(modelId) {
      return resolveFallbackProvider().imageModel(modelId);
    },
    transcriptionModel(modelId) {
      return delegateToProvider(
        resolveFallbackProvider() as ProviderV3,
        'transcriptionModel',
        modelId,
      ) as TranscriptionModelV3;
    },
    speechModel(modelId) {
      return delegateToProvider(resolveFallbackProvider() as ProviderV3, 'speechModel', modelId) as SpeechModelV3;
    },
    rerankingModel(modelId) {
      return delegateToProvider(resolveFallbackProvider() as ProviderV3, 'rerankingModel', modelId) as RerankingModelV3;
    },
  };

  return customProvider({
    ...registry,
    fallbackProvider: lazyFallbackProvider,
  });
}
