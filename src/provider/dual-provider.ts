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
 *
 * A Proxy keeps the wrapper aligned with future `OpenAIProvider` additions instead
 * of manually forwarding a fixed method list that can drift from upstream.
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

  return new Proxy(provider, {
    apply(_target, _thisArg, args: Parameters<OpenAIProvider>) {
      return pickProvider()(...args);
    },
    get(_target, prop) {
      const selectedProvider = pickProvider();
      const value = Reflect.get(selectedProvider, prop, selectedProvider);
      return typeof value === 'function' ? value.bind(selectedProvider) : value;
    },
    has(_target, prop) {
      return prop in pickProvider();
    },
    set(_target, prop, value) {
      Reflect.set(pickProvider() as object, prop, value);
      return true;
    },
    defineProperty(_target, prop, descriptor) {
      return Reflect.defineProperty(pickProvider() as object, prop, descriptor);
    },
    deleteProperty(_target, prop) {
      return Reflect.deleteProperty(pickProvider() as object, prop);
    },
    ownKeys() {
      return Reflect.ownKeys(pickProvider());
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Object.getOwnPropertyDescriptor(pickProvider(), prop);
    },
  });
}
