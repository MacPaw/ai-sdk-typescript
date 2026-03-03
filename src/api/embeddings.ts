/**
 * Embeddings API facade.
 */

import type { ResolvedConfig } from '../core/config';
import { runRequest } from '../core/request';
import { validateEmbeddingRequest } from '../core/validation';
import { API_PATHS } from '../core/paths';
import type { CreateEmbeddingRequest, CreateEmbeddingResponse, RequestOptions } from '../core/types';

export async function createEmbedding(
  config: ResolvedConfig,
  request: CreateEmbeddingRequest,
  options?: RequestOptions
): Promise<CreateEmbeddingResponse | { data: CreateEmbeddingResponse; response: Response }> {
  validateEmbeddingRequest(request);
  const body = JSON.stringify(request);
  const response = await runRequest(config, API_PATHS.Embeddings, { method: 'POST', body }, options);
  const data = (await response.json()) as CreateEmbeddingResponse;
  if (options?.withResponse) return { data, response };
  return data;
}
