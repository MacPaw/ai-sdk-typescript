import type { OpenAIProvider } from '@ai-sdk/openai';
import type { AIGatewayProviderSource } from './provider-source';
import { resolveAIGatewayProvider } from './provider-source';

export interface AIGatewayDualProviderOptions {
  /**
   * Toggle between the gateway-backed provider and a direct OpenAI-compatible provider.
   * This is designed for environment-flag workflows such as `IS_SETAPP_BUILD`.
   */
  useGateway: boolean | (() => boolean);
  /** AI Gateway provider options or a prebuilt gateway provider instance. */
  gateway: AIGatewayProviderSource;
  /** Direct OpenAI-compatible provider used when `useGateway` is false. */
  direct: OpenAIProvider;
}

/**
 * Create a provider that switches between AI Gateway and a direct OpenAI-compatible
 * backend without changing the surrounding `ai-sdk` integration code.
 */
export function createAIGatewayDualProvider(options: AIGatewayDualProviderOptions): OpenAIProvider {
  const gatewayProvider = resolveAIGatewayProvider(options.gateway);

  const pickProvider = (): OpenAIProvider =>
    (typeof options.useGateway === 'function' ? options.useGateway() : options.useGateway)
      ? gatewayProvider
      : options.direct;

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
