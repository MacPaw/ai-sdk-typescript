/**
 * Vercel AI SDK-compatible entry: re-exports the full `ai` package and adds MacPaw AI Gateway.
 *
 * Migration: replace `from 'ai'` with `from '@macpaw/ai-sdk/ai'` or `from '@macpaw/ai-sdk/provider'`
 * (same module). Subpaths: `ai/internal` → `@macpaw/ai-sdk/ai/internal`, `ai/test` → `@macpaw/ai-sdk/ai/test`.
 * Wire `createAIGatewayProvider`, `createGatewayProvider`, or dual/custom registry helpers;
 * use gateway errors from this package where needed.
 */

export * from 'ai';

export { createAIGatewayFetch } from './create-fetch';
export type { CreateAIGatewayFetchOptions } from './create-fetch';

export { createAIGatewayProvider } from './ai-gateway-provider';
export type { AIGatewayProviderOptions } from './ai-gateway-provider';

export { createAIGatewayCustomProvider } from './custom-registry';
export type { AIGatewayCustomProviderRegistry } from './custom-registry';
export { createAIGatewayDualProvider } from './dual-provider';
export type { AIGatewayDualProviderOptions } from './dual-provider';
export type { AIGatewayProviderSource, OpenAIProviderSource, Resolvable } from './provider-source';

export { createGatewayProvider, GATEWAY_PROVIDERS } from './gateway-provider';
export type {
  GatewayOpenAICompatibleOptions,
  GatewayProviderBaseOptions,
  GatewayProvider,
  GatewayProviderOptions,
  GatewayProviderOptionsMap,
  GatewayProviderWithDefaultPrefix,
} from './gateway-provider';

export { createOpenAI } from '@ai-sdk/openai';
export type { OpenAIProvider, OpenAIProviderSettings } from '@ai-sdk/openai';

export {
  AIGatewayError,
  AIGatewayErrorCodes,
  AuthError,
  CreditsError,
  ModelNotAllowedError,
  RateLimitError,
  ValidationError,
  isAIGatewayError,
  parseErrorResponse,
} from '../runtime/errors';
export type { NormalizedErrorMetadata } from '../runtime/errors';
export { ErrorCode } from '../types';
