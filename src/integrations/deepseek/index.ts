/**
 * Re-export `@ai-sdk/deepseek` under `@macpaw/ai-sdk/deepseek`.
 * Peer: `@ai-sdk/deepseek` (install in the app).
 */
export * from '@ai-sdk/deepseek';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../../provider/gateway-provider-mirror';

export type GatewayDeepseekOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for DeepSeek models.
 *
 * Bare model IDs are prefixed with `deepseek/` automatically, so
 * `createGatewayDeepseek(opts)('deepseek-chat')` routes through Gateway
 * as `deepseek/deepseek-chat`.
 */
export function createGatewayDeepseek(options: GatewayDeepseekOptions): OpenAIProvider {
  return createGatewayProviderMirror('deepseek', options);
}
