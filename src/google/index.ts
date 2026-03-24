/**
 * Re-export `@ai-sdk/google` under `@macpaw/ai-sdk/google`.
 * Peer: `@ai-sdk/google` (install in the app).
 */
export * from '@ai-sdk/google';

import type { OpenAIProvider } from '@ai-sdk/openai';
import { createGatewayProviderMirror } from '../provider/gateway-provider-mirror';
import type { GatewayProviderMirrorOptions } from '../provider/gateway-provider-mirror';

export type GatewayGoogleOptions = GatewayProviderMirrorOptions;

/**
 * Creates an AI Gateway-backed provider pre-configured for Google models.
 *
 * Bare model IDs are prefixed with `google/` automatically, so
 * `createGatewayGoogle(opts)('gemini-2.5-pro')` routes through Gateway
 * as `google/gemini-2.5-pro`.
 */
export function createGatewayGoogle(options: GatewayGoogleOptions): OpenAIProvider {
  return createGatewayProviderMirror('google', options);
}
