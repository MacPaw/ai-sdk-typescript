import type { OpenAIProvider } from '@ai-sdk/openai';
import { createAIGatewayProvider } from './ai-gateway-provider';
import type { AIGatewayProviderOptions } from './ai-gateway-provider';

/**
 * Allow direct values or lazy factories for provider sources.
 * This keeps provider setup flexible for build-flag and env-driven flows.
 */
export type Resolvable<T> = T | (() => T);

/**
 * Accept either AI Gateway provider options or a prebuilt OpenAI-compatible provider.
 * This keeps higher-level helpers flexible without forcing config duplication.
 */
export type AIGatewayProviderSource = Resolvable<AIGatewayProviderOptions | OpenAIProvider>;

/** Accept a prebuilt OpenAI-compatible provider or a lazy factory that creates one. */
export type OpenAIProviderSource = Resolvable<OpenAIProvider>;

function isProviderLike(value: unknown): value is OpenAIProvider {
  return typeof value === 'function' && typeof (value as OpenAIProvider).languageModel === 'function';
}

function isFactory<T>(value: Resolvable<T>): value is () => T {
  return typeof value === 'function' && !isProviderLike(value);
}

export function resolveProviderSource<T>(source: Resolvable<T>): T {
  return isFactory(source) ? source() : source;
}

export function isOpenAIProvider(value: AIGatewayProviderOptions | OpenAIProvider): value is OpenAIProvider {
  return isProviderLike(value);
}

export function resolveAIGatewayProvider(source: AIGatewayProviderSource): OpenAIProvider {
  const resolved = resolveProviderSource(source);
  return isOpenAIProvider(resolved) ? resolved : createAIGatewayProvider(resolved);
}

export function resolveOpenAIProvider(source: OpenAIProviderSource): OpenAIProvider {
  return resolveProviderSource(source);
}
