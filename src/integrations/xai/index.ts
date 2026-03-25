/**
 * Re-export `@ai-sdk/xai` under `@macpaw/ai-sdk/xai`.
 * Peer: `@ai-sdk/xai` (install in the app).
 */
export * from '@ai-sdk/xai';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../../provider/gateway-provider-mirror';

export type GatewayXaiOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for xAI models.
 *
 * Bare model IDs are prefixed with `xai/` automatically, so
 * `createGatewayXai(opts)('grok-3')` routes through Gateway as `xai/grok-3`.
 */
export function createGatewayXai(options: GatewayXaiOptions): OpenAIProvider {
  return createGatewayProviderMirror('xai', options);
}
