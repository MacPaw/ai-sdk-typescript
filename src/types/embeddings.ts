import type { ObjectValues } from './util';

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
