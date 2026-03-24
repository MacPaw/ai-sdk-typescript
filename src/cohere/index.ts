/**
 * Re-export `@ai-sdk/cohere` under `@macpaw/ai-sdk/cohere`.
 * Peer: `@ai-sdk/cohere` (install in the app).
 */
export * from '@ai-sdk/cohere';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../provider/gateway-provider-mirror';

export type GatewayCohereOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for Cohere models.
 *
 * Bare model IDs are prefixed with `cohere/` automatically, so
 * `createGatewayCohere(opts)('command-r-plus')` routes through Gateway
 * as `cohere/command-r-plus`.
 */
export function createGatewayCohere(options: GatewayCohereOptions): OpenAIProvider {
  return createGatewayProviderMirror('cohere', options);
}
