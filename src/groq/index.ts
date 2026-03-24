/**
 * Re-export `@ai-sdk/groq` under `@macpaw/ai-sdk/groq`.
 * Peer: `@ai-sdk/groq` (install in the app).
 */
export * from '@ai-sdk/groq';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../provider/gateway-provider-mirror';

export type GatewayGroqOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for Groq models.
 *
 * Bare model IDs are prefixed with `groq/` automatically, so
 * `createGatewayGroq(opts)('llama-3.3-70b-versatile')` routes through Gateway
 * as `groq/llama-3.3-70b-versatile`.
 */
export function createGatewayGroq(options: GatewayGroqOptions): OpenAIProvider {
  return createGatewayProviderMirror('groq', options);
}
