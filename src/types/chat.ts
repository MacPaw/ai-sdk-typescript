import type { ObjectValues } from './util';

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
