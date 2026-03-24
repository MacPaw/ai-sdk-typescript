/**
 * Pre-built response fixtures that eliminate boilerplate in tests.
 * Every factory accepts an optional partial override — just pass the fields you care about.
 */

import type {
  ChatCompletion,
  ChatCompletionUsage,
  ResponseObject,
  ResponseUsage,
  CreateEmbeddingResponse,
  CreateImageResponse,
  TranscriptionResponse,
  TranslationResponse,
  ModelInfoResponse,
  ModelEntry,
} from '../types';

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface MockChatCompletionOptions {
  id?: string;
  model?: string;
  content?: string | null;
  role?: 'assistant';
  finishReason?: string | null;
  usage?: ChatCompletionUsage;
}

/**
 * Create a `ChatCompletion` fixture with sensible defaults.
 *
 * @example
 * ```ts
 * client.chat.completions.create.mockResolvedValue(
 *   createMockChatCompletion({ content: 'Hello!' }),
 * );
 * ```
 */
export function createMockChatCompletion(opts?: MockChatCompletionOptions): ChatCompletion {
  return {
    id: opts?.id ?? 'chatcmpl-mock',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: opts?.model ?? 'mock-model',
    choices: [
      {
        index: 0,
        message: {
          role: opts?.role ?? 'assistant',
          content: opts?.content ?? 'Mock response',
        },
        finish_reason: (opts?.finishReason as 'stop') ?? 'stop',
      },
    ],
    usage: opts?.usage,
  };
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface MockResponseObjectOptions {
  id?: string;
  model?: string;
  content?: string;
  status?: 'completed' | 'in_progress' | 'failed' | 'incomplete' | 'cancelled';
  usage?: ResponseUsage;
}

/**
 * Create a `ResponseObject` fixture with sensible defaults.
 *
 * @example
 * ```ts
 * client.responses.create.mockResolvedValue(
 *   createMockResponseObject({ content: 'Hello!' }),
 * );
 * ```
 */
export function createMockResponseObject(opts?: MockResponseObjectOptions): ResponseObject {
  const content = opts?.content ?? 'Mock response';
  return {
    id: opts?.id ?? 'resp-mock',
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    status: opts?.status ?? 'completed',
    model: opts?.model ?? 'mock-model',
    output: [
      {
        type: 'message',
        id: 'msg-mock',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: content }],
      },
    ],
    usage: opts?.usage,
  };
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export interface MockEmbeddingResponseOptions {
  model?: string;
  /** Embedding vectors. Defaults to a single `[0.1, 0.2, 0.3]`. */
  embeddings?: number[][];
  usage?: { prompt_tokens: number; total_tokens: number };
}

/**
 * Create a `CreateEmbeddingResponse` fixture.
 *
 * @example
 * ```ts
 * client.embeddings.create.mockResolvedValue(
 *   createMockEmbeddingResponse({ embeddings: [[0.1, 0.2]] }),
 * );
 * ```
 */
export function createMockEmbeddingResponse(opts?: MockEmbeddingResponseOptions): CreateEmbeddingResponse {
  const vectors = opts?.embeddings ?? [[0.1, 0.2, 0.3]];
  return {
    object: 'list',
    data: vectors.map((embedding, index) => ({
      object: 'embedding' as const,
      embedding,
      index,
    })),
    model: opts?.model ?? 'text-embedding-mock',
    usage: opts?.usage ?? { prompt_tokens: 5, total_tokens: 5 },
  };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export interface MockImageResponseOptions {
  /** Array of image URLs or base64 strings. Defaults to one URL. */
  urls?: string[];
  b64?: string[];
}

/**
 * Create a `CreateImageResponse` fixture.
 *
 * @example
 * ```ts
 * client.images.generate.mockResolvedValue(
 *   createMockImageResponse({ urls: ['https://example.com/cat.png'] }),
 * );
 * ```
 */
export function createMockImageResponse(opts?: MockImageResponseOptions): CreateImageResponse {
  const data = opts?.urls?.map((url) => ({ url })) ??
    opts?.b64?.map((b64_json) => ({ b64_json })) ?? [{ url: 'https://mock.test/image.png' }];

  return {
    created: Math.floor(Date.now() / 1000),
    data,
  };
}

// ---------------------------------------------------------------------------
// Audio — Transcription
// ---------------------------------------------------------------------------

export interface MockTranscriptionResponseOptions {
  text?: string;
  language?: string;
  duration?: number;
}

/**
 * Create a `TranscriptionResponse` fixture.
 *
 * @example
 * ```ts
 * client.audio.transcriptions.create.mockResolvedValue(
 *   createMockTranscriptionResponse({ text: 'Hello world' }),
 * );
 * ```
 */
export function createMockTranscriptionResponse(opts?: MockTranscriptionResponseOptions): TranscriptionResponse {
  return {
    text: opts?.text ?? 'Mock transcription',
    language: opts?.language,
    duration: opts?.duration,
  };
}

// ---------------------------------------------------------------------------
// Audio — Translation
// ---------------------------------------------------------------------------

export interface MockTranslationResponseOptions {
  text?: string;
  language?: string;
  duration?: number;
}

/**
 * Create a `TranslationResponse` fixture.
 *
 * @example
 * ```ts
 * client.audio.translations.create.mockResolvedValue(
 *   createMockTranslationResponse({ text: 'Translated text' }),
 * );
 * ```
 */
export function createMockTranslationResponse(opts?: MockTranslationResponseOptions): TranslationResponse {
  return {
    text: opts?.text ?? 'Mock translation',
    language: opts?.language,
    duration: opts?.duration,
  };
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export interface MockModelInfoResponseOptions {
  models?: Array<{
    name: string;
    mode?: 'chat' | 'completion' | 'embedding' | 'responses';
  }>;
}

/**
 * Create a `ModelInfoResponse` fixture.
 *
 * @example
 * ```ts
 * client.models.getInfo.mockResolvedValue(
 *   createMockModelInfoResponse({
 *     models: [{ name: 'openai/gpt-4.1-nano', mode: 'chat' }],
 *   }),
 * );
 * ```
 */
export function createMockModelInfoResponse(opts?: MockModelInfoResponseOptions): ModelInfoResponse {
  const entries: ModelEntry[] = (opts?.models ?? [{ name: 'mock-model', mode: 'chat' }]).map((m) => ({
    model_name: m.name,
    model_info: {
      id: m.name,
      mode: m.mode ?? 'chat',
    },
  }));

  return { data: entries };
}
