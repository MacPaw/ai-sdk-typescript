/**
 * Shared surface for AI Gateway integrations.
 *
 * Use `@macpaw/ai-sdk/provider` for Vercel AI SDK applications.
 * Use `@macpaw/ai-sdk/client` for the advanced low-level Gateway HTTP client.
 */

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
} from './runtime/errors';
export type { NormalizedErrorMetadata } from './runtime/errors';

export {
  ErrorCode,
  GatewayApiCode,
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
} from './types';

export { SDKValidationError } from './runtime/validation';

export {
  extractChatDelta,
  collectChatStream,
  extractResponseDelta,
  collectResponseStream,
  extractTranscriptionDelta,
  collectTranscriptionStream,
} from './helpers';

export type { ObjectValues } from './types';
