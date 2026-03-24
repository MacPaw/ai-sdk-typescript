/**
 * Vercel AI SDK `customProvider` wired to AI Gateway as the fallback provider.
 */

import type {
  EmbeddingModelV3,
  Experimental_VideoModelV3,
  ImageModelV3,
  LanguageModelV3,
  ProviderV3,
  RerankingModelV3,
  SpeechModelV3,
  TranscriptionModelV3,
} from '@ai-sdk/provider';
import { customProvider } from 'ai';
import { createAIGatewayProvider } from './ai-gateway-provider';
import type { AIGatewayProviderOptions } from './ai-gateway-provider';

/**
 * Builds a {@link customProvider} whose `fallbackProvider` is an AI Gateway OpenAI-compatible
 * provider from {@link createAIGatewayProvider}. Use `languageModels`, `embeddingModels`, etc.
 * to register aliases or restrict models; unknown IDs resolve through the gateway fallback.
 *
 * @example
 * ```ts
 * import { createAIGatewayCustomProvider, generateText } from '@macpaw/ai-sdk/provider';
 *
 * const gateway = createAIGatewayProvider({
 *   getAuthToken: async () => token,
 *   env: 'production',
 * });
 *
 * const registry = createAIGatewayCustomProvider(
 *   { getAuthToken: async () => token, env: 'production' },
 *   {
 *     languageModels: {
 *       fast: gateway('openai/gpt-4.1-nano'),
 *     },
 *   },
 * );
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
  VIDEO_MODELS extends Record<string, Experimental_VideoModelV3> = Record<string, never>,
>(
  gatewayOptions: AIGatewayProviderOptions,
  registry: {
    languageModels?: LANGUAGE_MODELS;
    embeddingModels?: EMBEDDING_MODELS;
    imageModels?: IMAGE_MODELS;
    transcriptionModels?: TRANSCRIPTION_MODELS;
    speechModels?: SPEECH_MODELS;
    rerankingModels?: RERANKING_MODELS;
    videoModels?: VIDEO_MODELS;
  },
): ProviderV3 & {
  languageModel(modelId: Extract<keyof LANGUAGE_MODELS, string>): LanguageModelV3;
  embeddingModel(modelId: Extract<keyof EMBEDDING_MODELS, string>): EmbeddingModelV3;
  imageModel(modelId: Extract<keyof IMAGE_MODELS, string>): ImageModelV3;
  transcriptionModel(modelId: Extract<keyof TRANSCRIPTION_MODELS, string>): TranscriptionModelV3;
  speechModel(modelId: Extract<keyof SPEECH_MODELS, string>): SpeechModelV3;
  rerankingModel(modelId: Extract<keyof RERANKING_MODELS, string>): RerankingModelV3;
  videoModel(modelId: Extract<keyof VIDEO_MODELS, string>): Experimental_VideoModelV3;
} {
  const fallbackProvider = createAIGatewayProvider(gatewayOptions);

  return customProvider({
    ...registry,
    fallbackProvider,
  });
}
