/**
 * AI Gateway provider entry.
 *
 * This entry exposes MacPaw's gateway-aware provider helpers only.
 * Import `generateText`, `streamText`, `customProvider`, and other Vercel AI SDK
 * primitives directly from the upstream `ai` package.
 */

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

export {
  AIGatewayError,
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
