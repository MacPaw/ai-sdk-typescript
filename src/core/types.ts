/**
 * Core types for AI Gateway SDK.
 * Request/response types align with OpenAI-compatible API used by the BFF.
 */

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Extract the union of all property values from a const object. */
export type ObjectValues<T> = T[keyof T];

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/** Raw error codes returned by the BFF API. */
export const BFFCode = {
  BadRequest: 'BAD_REQUEST',
  Unauthorized: 'UNAUTHORIZED',
  InsufficientCredits: 'INSUFFICIENT_CREDITS',
  Forbidden: 'FORBIDDEN',
  Validation: 'VALIDATION',
  RateLimitExceeded: 'RATE_LIMIT_EXCEEDED',
  InternalServerError: 'INTERNAL_SERVER_ERROR',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
  Timeout: 'TIMEOUT',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
} as const;
export type BFFCode = ObjectValues<typeof BFFCode>;

/** Normalized error codes for app handling (User Story AC). */
export const ErrorCode = {
  AuthRequired: 'AUTH_REQUIRED',
  InsufficientCredits: 'INSUFFICIENT_CREDITS',
  SubscriptionExpired: 'SUBSCRIPTION_EXPIRED',
  ModelNotAllowed: 'MODEL_NOT_ALLOWED',
  RateLimited: 'RATE_LIMITED',
  BadRequest: 'BAD_REQUEST',
  Validation: 'VALIDATION',
  Forbidden: 'FORBIDDEN',
  InternalServerError: 'INTERNAL_SERVER_ERROR',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
  Timeout: 'TIMEOUT',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
} as const;
export type ErrorCode = ObjectValues<typeof ErrorCode>;

/**
 * @deprecated Use `ErrorCode` instead. Will be removed in a future major version.
 */
export type AIGatewayErrorCode = ErrorCode;

// ---------------------------------------------------------------------------
// Error response shapes
// ---------------------------------------------------------------------------

export interface BFFErrorItem {
  target?: string;
  property?: string;
  constraints?: string[];
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface BFFErrorResponse {
  statusCode: number;
  message: string;
  timestamp: string;
  code: BFFCode;
  path?: string;
  errors?: BFFErrorItem[];
  request_id?: string;
}

export interface OpenAIErrorResponse {
  error: {
    message: string;
    type?: string | null;
    code?: string | null;
    param?: string | null;
  };
  request_id?: string;
}

// ---------------------------------------------------------------------------
// Chat Completions API
// ---------------------------------------------------------------------------

export const MessageRole = {
  System: 'system',
  User: 'user',
  Assistant: 'assistant',
  Developer: 'developer',
  Tool: 'tool',
} as const;
export type MessageRole = ObjectValues<typeof MessageRole>;

export const FinishReason = {
  Stop: 'stop',
  Length: 'length',
  ToolCalls: 'tool_calls',
  ContentFilter: 'content_filter',
} as const;
export type FinishReason = ObjectValues<typeof FinishReason>;

export interface ChatMessage {
  role: MessageRole;
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}

/**
 * Request payload for creating a chat completion.
 *
 * @example
 * ```ts
 * const request: CreateChatCompletionRequest = {
 *   model: 'openai/gpt-4.1-nano',
 *   messages: [
 *     { role: MessageRole.System, content: 'You are a helpful assistant.' },
 *     { role: MessageRole.User, content: 'Hello!' },
 *   ],
 *   temperature: 0.7,
 *   stream: true,
 * };
 * ```
 */
export interface CreateChatCompletionRequest {
  /** Model identifier (e.g. `'openai/gpt-4.1-nano'`). */
  model: string;
  /** The conversation messages. */
  messages: ChatMessage[];
  /** Set to `true` for streaming responses via SSE. */
  stream?: boolean;
  /** Sampling temperature (0–2). Higher = more random. */
  temperature?: number;
  /** Maximum tokens to generate. */
  max_tokens?: number;
  /** Tool definitions for function calling. */
  tools?: Array<{ type: 'function'; function: { name: string; description?: string; parameters?: object } }>;
  /** How the model should select tools. */
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  [key: string]: unknown;
}

export interface ChatCompletionMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}

export interface ChatCompletionChoice {
  index: number;
  message?: ChatCompletionMessage;
  delta?: { role?: string; content?: string | null; tool_calls?: unknown[] };
  finish_reason: FinishReason | null;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage | null;
}

// ---------------------------------------------------------------------------
// Responses API (OpenAI Create Response format)
// ---------------------------------------------------------------------------

export type CreateResponseInputItem =
  | { type: 'message'; role: string; content: string | unknown[] }
  | { type: string; [key: string]: unknown };

/**
 * Request payload for creating a response (OpenAI Create Response format).
 *
 * @example
 * ```ts
 * const request: CreateResponseRequest = {
 *   model: 'openai/gpt-4.1-nano',
 *   input: 'Explain TypeScript generics.',
 * };
 * ```
 */
export interface CreateResponseRequest {
  /** Model identifier (e.g. `'openai/gpt-4.1-nano'`). */
  model: string;
  /** A string prompt or an array of structured input items. */
  input: string | CreateResponseInputItem[];
  /** Set to `true` for streaming responses. */
  stream?: boolean;
  /** Sampling temperature (0–2). */
  temperature?: number;
  /** Maximum output tokens. */
  max_output_tokens?: number;
  /** Tool definitions. */
  tools?: unknown[];
  /** How the model should select tools. */
  tool_choice?: string | object;
  [key: string]: unknown;
}

export interface ResponseUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export const ResponseStatus = {
  InProgress: 'in_progress',
  Completed: 'completed',
  Failed: 'failed',
  Incomplete: 'incomplete',
  Cancelled: 'cancelled',
} as const;
export type ResponseStatus = ObjectValues<typeof ResponseStatus>;

export interface ResponseOutputMessage {
  type: 'message';
  id: string;
  role: 'assistant';
  status: 'completed' | 'in_progress';
  content: Array<{
    type: 'output_text';
    text: string;
    annotations?: unknown[];
  }>;
}

export interface ResponseObject {
  id: string;
  object: 'response';
  created_at: number;
  status: ResponseStatus;
  model: string;
  output: ResponseOutputMessage[];
  usage?: ResponseUsage;
  error?: { code: string; message: string } | null;
  metadata?: Record<string, string>;
  [key: string]: unknown;
}

export interface ResponseStreamEvent {
  type: string;
  delta?: string;
  response?: ResponseObject;
  item?: ResponseOutputMessage;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Embeddings API
// ---------------------------------------------------------------------------

export const EmbeddingFormat = {
  Float: 'float',
  Base64: 'base64',
} as const;
export type EmbeddingFormat = ObjectValues<typeof EmbeddingFormat>;

/**
 * Request payload for creating embeddings.
 *
 * @example
 * ```ts
 * const request: CreateEmbeddingRequest = {
 *   model: 'text-embedding-3-small',
 *   input: ['Hello', 'World'],
 *   dimensions: 256,
 * };
 * ```
 */
export interface CreateEmbeddingRequest {
  /** Model identifier (e.g. `'text-embedding-3-small'`). */
  model: string;
  /** Text or array of texts to embed. */
  input: string | string[];
  /** Output encoding format. */
  encoding_format?: EmbeddingFormat;
  /** Desired output dimensionality (model-dependent). */
  dimensions?: number;
}

export interface EmbeddingItem {
  object: 'embedding';
  embedding: number[];
  index: number;
}

export interface CreateEmbeddingResponse {
  object: 'list';
  data: EmbeddingItem[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

// ---------------------------------------------------------------------------
// Images API
// ---------------------------------------------------------------------------

export const ImageSize = {
  S256: '256x256',
  S512: '512x512',
  S1024: '1024x1024',
  L1792x1024: '1792x1024',
  L1024x1792: '1024x1792',
} as const;
export type ImageSize = ObjectValues<typeof ImageSize>;

export const ImageQuality = {
  Standard: 'standard',
  HD: 'hd',
} as const;
export type ImageQuality = ObjectValues<typeof ImageQuality>;

export const ImageStyle = {
  Vivid: 'vivid',
  Natural: 'natural',
} as const;
export type ImageStyle = ObjectValues<typeof ImageStyle>;

export const ImageResponseFormat = {
  Url: 'url',
  B64Json: 'b64_json',
} as const;
export type ImageResponseFormat = ObjectValues<typeof ImageResponseFormat>;

/**
 * Request payload for generating images.
 *
 * @example
 * ```ts
 * const request: CreateImageRequest = {
 *   prompt: 'A cat wearing a top hat',
 *   model: 'dall-e-3',
 *   size: ImageSize.S1024,
 *   quality: ImageQuality.HD,
 * };
 * ```
 */
export interface CreateImageRequest {
  /** Text description of the desired image. */
  prompt: string;
  /** Model identifier (e.g. `'dall-e-3'`). */
  model?: string;
  /** Number of images to generate. */
  n?: number;
  /** Image dimensions. */
  size?: ImageSize;
  /** Rendering quality. */
  quality?: ImageQuality;
  /** Response format (URL or base64). */
  response_format?: ImageResponseFormat;
  /** Visual style. */
  style?: ImageStyle;
  [key: string]: unknown;
}

export interface ImageDataItem {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

export interface CreateImageResponse {
  created: number;
  data: ImageDataItem[];
}

export interface CreateImageEditRequest {
  image: Blob | File;
  prompt: string;
  model?: string;
  mask?: Blob | File;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024';
  response_format?: ImageResponseFormat;
}

// ---------------------------------------------------------------------------
// Audio API
// ---------------------------------------------------------------------------

export const AudioFormat = {
  Json: 'json',
  Text: 'text',
  Srt: 'srt',
  VerboseJson: 'verbose_json',
  Vtt: 'vtt',
  DiarizedJson: 'diarized_json',
} as const;
export type AudioFormat = ObjectValues<typeof AudioFormat>;

export const TranslationFormat = {
  Json: 'json',
  Text: 'text',
  Srt: 'srt',
  VerboseJson: 'verbose_json',
  Vtt: 'vtt',
} as const;
export type TranslationFormat = ObjectValues<typeof TranslationFormat>;

export interface CreateTranscriptionRequest {
  file: Blob | File;
  model: string;
  language?: string;
  prompt?: string;
  response_format?: AudioFormat;
  temperature?: number;
  timestamp_granularities?: Array<'word' | 'segment'>;
  stream?: boolean;
}

export interface TranscriptionResponse {
  text: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  duration?: number;
  language?: string;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens?: number[];
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
}

export interface TranscriptionStreamEvent {
  type: 'transcript.text.delta' | 'transcript.text.done';
  delta?: string;
  text?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface CreateTranslationRequest {
  file: Blob | File;
  model: string;
  prompt?: string;
  response_format?: TranslationFormat;
  temperature?: number;
}

export interface TranslationResponse {
  text: string;
  duration?: number;
  language?: string;
  segments?: TranscriptionSegment[];
}

// ---------------------------------------------------------------------------
// Models API
// ---------------------------------------------------------------------------

export interface ModelInfo {
  id: string;
  key?: string | null;
  mode?: 'chat' | 'completion' | 'embedding' | 'responses' | null;
  supports_system_messages?: boolean | null;
  supports_vision?: boolean | null;
  supports_function_calling?: boolean | null;
  supports_tool_choice?: boolean | null;
  supports_native_streaming?: boolean | null;
  [key: string]: unknown;
}

export interface ModelEntry {
  model_name: string;
  model_info: ModelInfo;
}

export interface ModelInfoResponse {
  data: ModelEntry[];
}

// ---------------------------------------------------------------------------
// Shared request options (per-call overrides)
// ---------------------------------------------------------------------------

/**
 * Per-request options that override client-level defaults.
 *
 * @example
 * ```ts
 * const result = await client.chat.completions.create(
 *   { model: 'openai/gpt-4.1-nano', messages: [...] },
 *   { timeout: 30_000, headers: { 'X-Custom': 'value' } },
 * );
 *
 * // Access response headers
 * const { data, response } = await client.chat.completions.create(
 *   { model: 'openai/gpt-4.1-nano', messages: [...] },
 *   { withResponse: true },
 * );
 * console.log(response.headers.get('x-request-id'));
 * ```
 */
export interface RequestOptions {
  /** An `AbortSignal` to cancel the request. Combined with the SDK's internal timeout signal. */
  signal?: AbortSignal;
  /** Request timeout in milliseconds. Overrides the client-level `timeout`. */
  timeout?: number;
  /** Extra headers merged into this request only. */
  headers?: Record<string, string>;
  /** When `true`, non-streaming methods return `{ data, response }` for header access. */
  withResponse?: boolean;
}

/**
 * Wrapper returned by non-streaming methods when `withResponse: true`.
 * Provides access to both the parsed data and the raw `Response` for header inspection.
 */
export interface WithResponseResult<T> {
  /** The parsed response body. */
  data: T;
  /** The raw `Response` object for header access. */
  response: Response;
}
