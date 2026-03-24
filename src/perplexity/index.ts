/**
 * Re-export `@ai-sdk/perplexity` under `@macpaw/ai-sdk/perplexity`.
 * Peer: `@ai-sdk/perplexity` (install in the app).
 */
export * from '@ai-sdk/perplexity';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../provider/gateway-provider-mirror';

export type GatewayPerplexityOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for Perplexity models.
 *
 * Bare model IDs are prefixed with `perplexity/` automatically, so
 * `createGatewayPerplexity(opts)('sonar-pro')` routes through Gateway
 * as `perplexity/sonar-pro`.
 */
export function createGatewayPerplexity(options: GatewayPerplexityOptions): OpenAIProvider {
  return createGatewayProviderMirror('perplexity', options);
}
