import type { OpenAIProvider } from '@ai-sdk/openai';
import { createAIGatewayProvider } from './ai-gateway-provider';
import type { AIGatewayProviderOptions } from './ai-gateway-provider';

export interface AIGatewayDualProviderOptions {
  /**
   * Toggle between the gateway-backed provider and a direct OpenAI-compatible provider.
   * This is designed for environment-flag workflows such as `IS_SETAPP_BUILD`.
   */
  useGateway: boolean | (() => boolean);
  /** AI Gateway provider options or a prebuilt gateway provider instance. */
  gateway: AIGatewayProviderOptions | OpenAIProvider;
  /** Direct OpenAI-compatible provider used when `useGateway` is false. */
  direct: OpenAIProvider;
}

function isOpenAIProvider(value: AIGatewayProviderOptions | OpenAIProvider): value is OpenAIProvider {
  return typeof value === 'function' && typeof value.languageModel === 'function';
}

/**
 * Create a provider that switches between AI Gateway and a direct OpenAI-compatible
 * backend without changing the surrounding `ai-sdk` integration code.
 */
export function createAIGatewayDualProvider(options: AIGatewayDualProviderOptions): OpenAIProvider {
  const gatewayProvider = isOpenAIProvider(options.gateway)
    ? options.gateway
    : createAIGatewayProvider(options.gateway);

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
