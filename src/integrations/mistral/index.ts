/**
 * Re-export `@ai-sdk/mistral` under `@macpaw/ai-sdk/mistral`.
 * Peer: `@ai-sdk/mistral` (install in the app).
 */
export * from '@ai-sdk/mistral';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../../provider/gateway-provider-mirror';

export type GatewayMistralOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for Mistral models.
 *
 * Bare model IDs are prefixed with `mistral/` automatically, so
 * `createGatewayMistral(opts)('mistral-large-latest')` routes through Gateway
 * as `mistral/mistral-large-latest`.
 */
export function createGatewayMistral(options: GatewayMistralOptions): OpenAIProvider {
  return createGatewayProviderMirror('mistral', options);
}
