/**
 * Provider utilities for Vercel AI SDK integration.
 *
 * Low-level: createAIGatewayFetch (custom fetch for any OpenAI-compatible client)
 * High-level: createAIGatewayProvider (full Vercel AI SDK provider)
 */

export { createAIGatewayFetch } from './create-fetch';
export type { CreateAIGatewayFetchOptions } from './create-fetch';

export { createAIGatewayProvider } from './ai-gateway-provider';
export type { AIGatewayProviderOptions } from './ai-gateway-provider';
