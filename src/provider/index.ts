/**
 * Provider utilities for Vercel AI SDK integration.
 *
 * Low-level: createAIGatewayFetch (custom fetch for any OpenAI-compatible client)
 * High-level: createAIGatewayProvider (full Vercel AI SDK provider)
 *
 * Also re-exports commonly used Vercel AI SDK functions so consumers
 * only need `@macpaw/ai` — no extra installs required.
 */

export { createAIGatewayFetch } from './create-fetch';
export type { CreateAIGatewayFetchOptions } from './create-fetch';

export { createAIGatewayProvider } from './ai-gateway-provider';
export type { AIGatewayProviderOptions } from './ai-gateway-provider';

export {
  generateText,
  streamText,
  generateObject,
  streamObject,
  embed,
  embedMany,
} from 'ai';
