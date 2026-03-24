import type { OpenAIProvider } from '@ai-sdk/openai';
import type { AIGatewayProviderSource, OpenAIProviderSource } from './provider-source';
import { resolveAIGatewayProvider, resolveOpenAIProvider } from './provider-source';

export interface AIGatewayDualProviderOptions {
  /**
   * Toggle between the gateway-backed provider and a direct OpenAI-compatible provider.
   * This is designed for environment-flag workflows such as `IS_SETAPP_BUILD`.
   */
  useGateway: boolean | (() => boolean);
  /** AI Gateway provider options, a prebuilt gateway provider, or a lazy factory for either. */
  gateway: AIGatewayProviderSource;
  /** Direct OpenAI-compatible provider or a lazy factory used when `useGateway` is false. */
  direct: OpenAIProviderSource;
}

/**
 * Create a provider that switches between AI Gateway and a direct OpenAI-compatible
 * backend without changing the surrounding `ai-sdk` integration code.
 */
export function createAIGatewayDualProvider(options: AIGatewayDualProviderOptions): OpenAIProvider {
  let cachedGatewayProvider: OpenAIProvider | undefined;
  let cachedDirectProvider: OpenAIProvider | undefined;

  const gatewayProvider = (): OpenAIProvider => (cachedGatewayProvider ??= resolveAIGatewayProvider(options.gateway));
  const directProvider = (): OpenAIProvider => (cachedDirectProvider ??= resolveOpenAIProvider(options.direct));

  const pickProvider = (): OpenAIProvider =>
    (typeof options.useGateway === 'function' ? options.useGateway() : options.useGateway)
      ? gatewayProvider()
      : directProvider();

  const provider = ((modelId: Parameters<OpenAIProvider>[0]) => pickProvider()(modelId)) as OpenAIProvider;

  provider.languageModel = (modelId) => pickProvider().languageModel(modelId);
  provider.chat = (modelId) => pickProvider().chat(modelId);
  provider.responses = (modelId) => pickProvider().responses(modelId);
  provider.completion = (modelId) => pickProvider().completion(modelId);
  provider.embedding = (modelId) => pickProvider().embedding(modelId);
  provider.embeddingModel = (modelId) => pickProvider().embeddingModel(modelId);
  provider.textEmbedding = (modelId) => pickProvider().textEmbedding(modelId);
  provider.textEmbeddingModel = (modelId) => pickProvider().textEmbeddingModel(modelId);
  provider.image = (modelId) => pickProvider().image(modelId);
  provider.imageModel = (modelId) => pickProvider().imageModel(modelId);
  provider.transcription = (modelId) => pickProvider().transcription(modelId);
  provider.speech = (modelId) => pickProvider().speech(modelId);

  Object.defineProperty(provider, 'tools', {
    enumerable: true,
    configurable: false,
    get() {
      return pickProvider().tools;
    },
  });

  return provider;
}
