/**
 * Root package entry.
 *
 * Re-exports the Vercel-compatible provider surface for easier migrations from `ai`,
 * while keeping advanced Gateway HTTP/client and runtime internals on explicit subpaths.
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
