import type { OpenAIProvider } from '@ai-sdk/openai';
import { createAIGatewayProvider } from './ai-gateway-provider';
import type { AIGatewayProviderOptions } from './ai-gateway-provider';

/**
 * Accept either AI Gateway provider options or a prebuilt OpenAI-compatible provider.
 * This keeps higher-level helpers flexible without forcing config duplication.
 */
export type AIGatewayProviderSource = AIGatewayProviderOptions | OpenAIProvider;

export function isOpenAIProvider(value: AIGatewayProviderSource): value is OpenAIProvider {
  return typeof value === 'function' && typeof value.languageModel === 'function';
}

export function resolveAIGatewayProvider(source: AIGatewayProviderSource): OpenAIProvider {
  return isOpenAIProvider(source) ? source : createAIGatewayProvider(source);
}
