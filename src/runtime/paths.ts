/**
 * Gateway HTTP API path constants (relative to baseURL).
 */

export type ApiVersion = 'v1' | (string & {});

export const DEFAULT_API_VERSION: ApiVersion = 'v1';

export function buildApiPaths(version: ApiVersion = DEFAULT_API_VERSION) {
  const prefix = `/api/${version}`;
  return {
    ChatCompletions: `${prefix}/chat/completions`,
    Embeddings: `${prefix}/embeddings`,
    ModelInfo: `${prefix}/model/info`,
    Responses: `${prefix}/responses`,
    AudioTranscriptions: `${prefix}/audio/transcriptions`,
    AudioTranslations: `${prefix}/audio/translations`,
    ImagesGenerations: `${prefix}/images/generations`,
    ImagesEdits: `${prefix}/images/edits`,
  } as const;
}

/** Default v1 paths — backward compatible. */
export const API_PATHS = buildApiPaths(DEFAULT_API_VERSION);

export type ApiPaths = ReturnType<typeof buildApiPaths>;
