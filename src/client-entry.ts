/**
 * Advanced low-level AI Gateway HTTP client.
 *
 * Prefer `@macpaw/ai-sdk/provider` for Vercel AI SDK applications.
 * Import this entry when you need multipart APIs, explicit middleware hooks,
 * or direct Gateway HTTP control outside the provider model.
 */

export { createAIGatewayClient } from './client';
export type {
  AIGatewayClient,
  ChatCompletionsAPI,
  ResponsesAPI,
  EmbeddingsAPI,
  ModelsAPI,
  ImagesAPI,
  AudioAPI,
} from './client';

export type {
  AIGatewayClientConfig,
  RetryConfig,
  Logger,
  Transport,
  Middleware,
  RequestConfig,
  ResolvedConfig,
  LifecycleHooks,
  Environment,
} from './runtime/config';
export { DEFAULT_RETRY, DEFAULT_BASE_URLS } from './runtime/config';

export type { ApiVersion, ApiPaths } from './runtime/paths';
export { API_PATHS, DEFAULT_API_VERSION } from './runtime/paths';

export type { StreamTextResult, StreamResponseResult } from './runtime/stream-result';
export { SDKValidationError } from './runtime/validation';
export { createFetchTransport } from './runtime/transport/fetch';
export type { FetchTransportOptions } from './runtime/transport/fetch';
export { anySignal } from './runtime/abort';
