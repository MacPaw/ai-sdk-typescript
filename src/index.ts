/**
 * @macpaw/ai
 *
 * Commercial Web SDK for AI Gateway. Universal TypeScript client for browser and Node.js.
 *
 * @example
 * ```ts
 * import { createAIGatewayClient, ErrorCode } from '@macpaw/ai';
 *
 * const client = createAIGatewayClient({
 *   env: 'production',
 *   getAuthToken: async () => (await getSetappSession()).accessToken,
 * });
 *
 * // Non-streaming
 * const completion = await client.chat.completions.create({
 *   model: 'openai/gpt-4.1-nano',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 *
 * // Rich streaming
 * const result = client.chat.completions.stream({
 *   model: 'openai/gpt-4.1-nano',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * for await (const delta of result.textStream) {
 *   process.stdout.write(delta);
 * }
 * const fullText = await result.text;
 * ```
 */

// Client
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

// Errors
export {
  AIGatewayErrorCodes,
  AIGatewayError,
  AuthError,
  CreditsError,
  RateLimitError,
  ModelNotAllowedError,
  ValidationError,
  isAIGatewayError,
  parseErrorResponse,
} from './core/errors';
export type { NormalizedErrorMetadata } from './core/errors';

// Const-object enums
export {
  ErrorCode,
  BFFCode,
  MessageRole,
  FinishReason,
  ResponseStatus,
  EmbeddingFormat,
  ImageSize,
  ImageQuality,
  ImageStyle,
  ImageResponseFormat,
  AudioFormat,
  TranslationFormat,
} from './core/types';

// Stream result types
export type { StreamTextResult, StreamResponseResult } from './core/stream-result';

// Validation
export { SDKValidationError } from './core/validation';

// Config
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
} from './core/config';
export { DEFAULT_RETRY, DEFAULT_BASE_URLS, resolveConfig } from './core/config';

// API paths & versioning
export type { ApiVersion, ApiPaths } from './core/paths';
export { API_PATHS, DEFAULT_API_VERSION, buildApiPaths } from './core/paths';

// Transport
export { createFetchTransport } from './transport/fetch';
export type { FetchTransportOptions } from './transport/fetch';
export { setDefaultTransport, resetDefaultTransport } from './core/request';

// Abort / signals
export { anySignal } from './core/abort';

// Helpers
export {
  extractChatDelta,
  collectChatStream,
  extractResponseDelta,
  collectResponseStream,
  extractTranscriptionDelta,
  collectTranscriptionStream,
} from './helpers';

// Utility types
export type { ObjectValues } from './core/types';

// Types
export type {
  // Chat
  CreateChatCompletionRequest,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionChoice,
  ChatCompletionMessage,
  ChatCompletionUsage,
  ChatMessage,
  // Responses
  CreateResponseRequest,
  ResponseObject,
  ResponseStreamEvent,
  ResponseOutputMessage,
  ResponseUsage,
  CreateResponseInputItem,
  // Embeddings
  CreateEmbeddingRequest,
  CreateEmbeddingResponse,
  EmbeddingItem,
  // Images
  CreateImageRequest,
  CreateImageResponse,
  CreateImageEditRequest,
  ImageDataItem,
  // Audio
  CreateTranscriptionRequest,
  TranscriptionResponse,
  TranscriptionStreamEvent,
  TranscriptionSegment,
  CreateTranslationRequest,
  TranslationResponse,
  // Models
  ModelInfoResponse,
  ModelEntry,
  ModelInfo,
  // Shared
  RequestOptions,
  WithResponseResult,
  // Error types (deprecated aliases — use ErrorCode / BFFCode instead)
  AIGatewayErrorCode,
  BFFErrorItem,
  BFFErrorResponse,
  OpenAIErrorResponse,
} from './core/types';
