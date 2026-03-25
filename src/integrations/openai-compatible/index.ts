/**
 * Re-export `@ai-sdk/openai-compatible` under `@macpaw/ai-sdk/openai-compatible`.
 * Peer: `@ai-sdk/openai-compatible` (install in the app).
 */
export * from '@ai-sdk/openai-compatible';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../../provider/gateway-provider-mirror';

export type GatewayOpenAICompatibleOptions = GatewayProviderMirrorOptions & {
  /**
   * Required for openai-compatible: the provider prefix used by the Gateway
   * to route to the correct backend (e.g. `'openai'`, `'fireworks_ai'`).
   */
  modelPrefix: string;
};

/**
 * Creates an AI Gateway-backed provider for an OpenAI-compatible backend.
 *
 * Unlike other mirrors, `modelPrefix` is required since there is no single
 * canonical prefix for generic OpenAI-compatible providers.
 *
 * @example
 * ```ts
 * const fireworks = createGatewayOpenAICompatible({
 *   modelPrefix: 'fireworks_ai',
 *   getAuthToken: async () => token,
 *   env: 'production',
 * });
 * const model = fireworks('accounts/fireworks/models/llama-v3p1-70b-instruct');
 * ```
 */
export function createGatewayOpenAICompatible(options: GatewayOpenAICompatibleOptions): OpenAIProvider {
  return createGatewayProviderMirror(options.modelPrefix, options);
}
