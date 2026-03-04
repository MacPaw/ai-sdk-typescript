/**
 * BFF API path constants (relative to baseURL).
 */

export const API_PATHS = {
  ChatCompletions: '/api/v1/chat/completions',
  Embeddings: '/api/v1/embeddings',
  ModelInfo: '/api/v1/model/info',
  Responses: '/api/v1/responses',
  AudioTranscriptions: '/api/v1/audio/transcriptions',
  AudioTranslations: '/api/v1/audio/translations',
  ImagesGenerations: '/api/v1/images/generations',
  ImagesEdits: '/api/v1/images/edits',
} as const;
