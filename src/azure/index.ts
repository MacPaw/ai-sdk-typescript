/**
 * Re-export `@ai-sdk/azure` under `@macpaw/ai-sdk/azure`.
 * Peer: `@ai-sdk/azure` (install in the app).
 */
export * from '@ai-sdk/azure';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../provider/gateway-provider-mirror';

export type GatewayAzureOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for Azure OpenAI models.
 *
 * Bare model IDs are prefixed with `azure/` automatically, so
 * `createGatewayAzure(opts)('gpt-4')` routes through Gateway as `azure/gpt-4`.
 */
export function createGatewayAzure(options: GatewayAzureOptions): OpenAIProvider {
  return createGatewayProviderMirror('azure', options);
}
