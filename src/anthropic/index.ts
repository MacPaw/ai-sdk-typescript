/**
 * Re-export `@ai-sdk/anthropic` under `@macpaw/ai-sdk/anthropic`.
 * Peer: `@ai-sdk/anthropic` (install in the app).
 */
export * from '@ai-sdk/anthropic';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../provider/gateway-provider-mirror';

export type GatewayAnthropicOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for Anthropic models.
 *
 * Bare model IDs are prefixed with `anthropic/` automatically, so
 * `createGatewayAnthropic(opts)('claude-sonnet-4-20250514')` routes through Gateway
 * as `anthropic/claude-sonnet-4-20250514`.
 */
export function createGatewayAnthropic(options: GatewayAnthropicOptions): OpenAIProvider {
  return createGatewayProviderMirror('anthropic', options);
}
