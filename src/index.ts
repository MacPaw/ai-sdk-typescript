/**
 * Root package entry.
 *
 * Exposes the MacPaw AI Gateway surface while keeping upstream Vercel AI SDK
 * primitives on their original packages (`ai`, `@ai-sdk/openai`, etc.).
 */

export * from './provider';

export {
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
