/**
 * Re-export `@ai-sdk/togetherai` under `@macpaw/ai-sdk/togetherai`.
 * Peer: `@ai-sdk/togetherai` (install in the app).
 */
export * from '@ai-sdk/togetherai';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../../provider/gateway-provider-mirror';

export type GatewayTogetherAIOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for Together AI models.
 *
 * Bare model IDs are prefixed with `togetherai/` automatically, so
 * `createGatewayTogetherAI(opts)('meta-llama/Llama-3-70b-chat-hf')` routes through
 * Gateway as `togetherai/meta-llama/Llama-3-70b-chat-hf`.
 */
export function createGatewayTogetherAI(options: GatewayTogetherAIOptions): OpenAIProvider {
  return createGatewayProviderMirror('togetherai', options);
}
