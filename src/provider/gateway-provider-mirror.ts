/**
 * Shared factory for creating gateway-backed provider mirrors.
 *
 * Each mirror (anthropic, google, xai, …) calls {@link createGatewayProviderMirror}
 * with its provider prefix so that bare model IDs (e.g. `claude-sonnet-4-20250514`)
 * are automatically routed as `anthropic/claude-sonnet-4-20250514` through the Gateway's
 * OpenAI-compatible endpoint.
 */

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createAIGatewayProvider } from './ai-gateway-provider';
import type { AIGatewayProviderOptions } from './ai-gateway-provider';

export interface GatewayProviderMirrorOptions extends AIGatewayProviderOptions {
  /**
   * Override the model ID prefix used for Gateway routing.
   * Default: the provider's canonical prefix (e.g. `'anthropic'`).
   *
   * Model IDs that already contain `/` are sent as-is.
   */
  modelPrefix?: string;
}

function prefixModelId(prefix: string, modelId: string): string {
  return modelId.includes('/') ? modelId : `${prefix}/${modelId}`;
}

/**
 * Creates an `OpenAIProvider` backed by AI Gateway that auto-prefixes
 * bare model IDs with the given provider name.
 *
 * This lets vendors write `provider('claude-sonnet-4-20250514')` instead of
 * `provider('anthropic/claude-sonnet-4-20250514')` while still routing through Gateway.
 */
export function createGatewayProviderMirror(
  defaultPrefix: string,
  options: GatewayProviderMirrorOptions,
): OpenAIProvider {
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
