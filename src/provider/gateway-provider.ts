/**
 * Typed gateway-backed provider factory.
 *
 * `createGatewayProvider()` centralizes the model-prefixing logic used to route
 * bare provider model IDs through AI Gateway's OpenAI-compatible endpoint.
 */

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createAIGatewayProvider } from './ai-gateway-provider';
import type { AIGatewayProviderOptions } from './ai-gateway-provider';

export interface GatewayProviderBaseOptions extends AIGatewayProviderOptions {
  /**
   * Override the model ID prefix used for Gateway routing.
   * Default: the provider's canonical prefix (e.g. `'anthropic'`).
   *
   * Model IDs that already contain `/` are sent as-is.
   */
  modelPrefix?: string;
}

export interface GatewayOpenAICompatibleOptions extends Omit<GatewayProviderBaseOptions, 'modelPrefix'> {
  /**
   * Required for openai-compatible backends because there is no single canonical
   * default prefix. Examples: `openai`, `fireworks_ai`, `openrouter`.
   */
  modelPrefix: string;
}

export const GATEWAY_PROVIDERS = {
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  XAI: 'xai',
  GROQ: 'groq',
  MISTRAL: 'mistral',
  AMAZON_BEDROCK: 'amazon-bedrock',
  AZURE: 'azure',
  COHERE: 'cohere',
  PERPLEXITY: 'perplexity',
  DEEPSEEK: 'deepseek',
  TOGETHERAI: 'togetherai',
  OPENAI_COMPATIBLE: 'openai-compatible',
} as const;

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[keyof typeof GATEWAY_PROVIDERS];

export type GatewayProviderWithDefaultPrefix = Exclude<GatewayProvider, typeof GATEWAY_PROVIDERS.OPENAI_COMPATIBLE>;

export interface GatewayProviderOptionsMap {
  [GATEWAY_PROVIDERS.OPENAI_COMPATIBLE]: GatewayOpenAICompatibleOptions;
}

export type GatewayProviderOptions<P extends GatewayProvider> = P extends keyof GatewayProviderOptionsMap
  ? GatewayProviderOptionsMap[P]
  : GatewayProviderBaseOptions;

const GATEWAY_PROVIDER_DEFAULT_PREFIXES: Record<GatewayProviderWithDefaultPrefix, string> = {
  [GATEWAY_PROVIDERS.ANTHROPIC]: 'anthropic',
  [GATEWAY_PROVIDERS.GOOGLE]: 'google',
  [GATEWAY_PROVIDERS.XAI]: 'xai',
  [GATEWAY_PROVIDERS.GROQ]: 'groq',
  [GATEWAY_PROVIDERS.MISTRAL]: 'mistral',
  [GATEWAY_PROVIDERS.AMAZON_BEDROCK]: 'bedrock',
  [GATEWAY_PROVIDERS.AZURE]: 'azure',
  [GATEWAY_PROVIDERS.COHERE]: 'cohere',
  [GATEWAY_PROVIDERS.PERPLEXITY]: 'perplexity',
  [GATEWAY_PROVIDERS.DEEPSEEK]: 'deepseek',
  [GATEWAY_PROVIDERS.TOGETHERAI]: 'togetherai',
};

function prefixModelId(prefix: string, modelId: string): string {
  return modelId.includes('/') ? modelId : `${prefix}/${modelId}`;
}

function createPrefixedGatewayProvider(defaultPrefix: string, options: GatewayProviderBaseOptions): OpenAIProvider {
  const { modelPrefix, ...providerOptions } = options;
  const prefix = modelPrefix ?? defaultPrefix;
  const provider = createAIGatewayProvider(providerOptions);

  const wrapped = ((modelId: string) => provider(prefixModelId(prefix, modelId))) as OpenAIProvider;

  return new Proxy(wrapped, {
    apply(_target, _thisArg, args: [string, ...unknown[]]) {
      const [modelId, ...rest] = args;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (provider as (...a: unknown[]) => any)(prefixModelId(prefix, modelId), ...rest);
    },
    get(_target, prop) {
      const value = Reflect.get(provider, prop, provider);
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          if (typeof args[0] === 'string') {
            args[0] = prefixModelId(prefix, args[0] as string);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (value as (...a: unknown[]) => any).apply(provider, args);
        };
      }
      return value;
    },
    has(_target, prop) {
      return prop in (provider as object);
    },
  });
}

/**
 * Creates an `OpenAIProvider` backed by AI Gateway for a supported provider.
 *
 * Bare model IDs are automatically prefixed with the provider's canonical
 * Gateway routing prefix. Model IDs that already contain `/` are passed as-is.
 */
export function createGatewayProvider(
  provider: GatewayProviderWithDefaultPrefix,
  options: GatewayProviderBaseOptions,
): OpenAIProvider;
export function createGatewayProvider(
  provider: typeof GATEWAY_PROVIDERS.OPENAI_COMPATIBLE,
  options: GatewayOpenAICompatibleOptions,
): OpenAIProvider;
export function createGatewayProvider(
  provider: GatewayProvider,
  options: GatewayProviderBaseOptions | GatewayOpenAICompatibleOptions,
): OpenAIProvider {
  if (provider === GATEWAY_PROVIDERS.OPENAI_COMPATIBLE) {
    return createPrefixedGatewayProvider(
      (options as GatewayOpenAICompatibleOptions).modelPrefix,
      options as GatewayOpenAICompatibleOptions,
    );
  }

  return createPrefixedGatewayProvider(
    GATEWAY_PROVIDER_DEFAULT_PREFIXES[provider as GatewayProviderWithDefaultPrefix],
    options as GatewayProviderBaseOptions,
  );
}
