/**
 * Re-export `@ai-sdk/amazon-bedrock` under `@macpaw/ai-sdk/amazon-bedrock`.
 * Peer: `@ai-sdk/amazon-bedrock` (install in the app).
 */
export * from '@ai-sdk/amazon-bedrock';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../../provider/gateway-provider-mirror';

export type GatewayBedrockOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for Amazon Bedrock models.
 *
 * Bare model IDs are prefixed with `bedrock/` automatically, so
 * `createGatewayBedrock(opts)('anthropic.claude-v2')` routes through Gateway
 * as `bedrock/anthropic.claude-v2`.
 */
export function createGatewayBedrock(options: GatewayBedrockOptions): OpenAIProvider {
  return createGatewayProviderMirror('bedrock', options);
}
