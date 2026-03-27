/**
 * AI Gateway provider entry.
 *
 * This entry exposes MacPaw's gateway-aware provider helpers only.
 * Import `generateText`, `streamText`, `customProvider`, and other Vercel AI SDK
 * primitives directly from the upstream `ai` package.
 */

export { createAIGatewayFetch } from './create-fetch';
export type { AIGatewayFetchFactoryConfig } from './create-fetch';

export { createAIGatewayProvider } from './ai-gateway-provider';
export type { AIGatewayProviderOptions } from './ai-gateway-provider';


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
  GatewayValidationError,
  ModelNotAllowedError,
  RateLimitError,
  isAIGatewayError,
  parseErrorResponse,
  ErrorCode,
  GatewayApiCode,
} from '../gateway-errors';
export type {
  NormalizedErrorMetadata,
  GatewayApiErrorItem,
  GatewayApiErrorResponse,
  OpenAIErrorResponse,
} from '../gateway-errors';
