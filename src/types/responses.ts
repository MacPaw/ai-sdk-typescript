import type { ObjectValues } from './util';

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
