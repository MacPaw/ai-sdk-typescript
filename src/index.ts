/**
 * Root package entry.
 *
 * Exposes the MacPaw AI Gateway surface while keeping upstream Vercel AI SDK
 * primitives on their original packages (`ai`, `@ai-sdk/openai`, etc.).
 */

// Main factory
export { createGatewayProvider, createAIGatewayProvider, GATEWAY_PROVIDERS } from './gateway-provider';
export type {
  GatewayProvider,
  GatewayProviderBaseOptions,
  GatewayOpenAICompatibleOptions,
  GatewayProviderOptions,
  GatewayProviderOptionsMap,
  GatewayProviderWithDefaultPrefix,
  AIGatewayProviderOptions,
} from './gateway-provider';

// Custom fetch bridge (for raw OpenAI client usage)
export { createGatewayFetch, GATEWAY_PLACEHOLDER_API_KEY } from './gateway-fetch';
export type { GatewayFetchConfig } from './gateway-fetch';

// Errors
export {
  AIGatewayError,
  AuthError,
  CreditsError,
  RateLimitError,
  ModelNotAllowedError,
  GatewayValidationError,
  isAIGatewayError,
  parseErrorResponse,
  GatewayApiCode,
  ErrorCode,
} from './gateway-errors';
export type {
  NormalizedErrorMetadata,
  GatewayApiErrorItem,
  GatewayApiErrorResponse,
  OpenAIErrorResponse,
} from './gateway-errors';

// Config types (consumers need these to configure the SDK)
export { DEFAULT_BASE_URLS, resolveGatewayBaseURL } from './gateway-config';
export type { Environment, GatewayProviderSettings, Middleware, RetryConfig } from './gateway-config';

// Video generation client
export { createVideoClient } from './gateway-videos';
export type {
  GatewayVideoClientOptions,
  VideoClient,
  VideoCreateRequest,
  VideoJob,
  VideoJobStatus,
  VideoJobError,
  VideoContentVariant,
} from './gateway-videos';
