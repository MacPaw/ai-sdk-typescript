/**
 * Embeddings API facade.
 */

import type { ResolvedConfig } from '../core/config';
import { runRequest } from '../core/request';
import { validateEmbeddingRequest } from '../core/validation';
import type { CreateEmbeddingRequest, CreateEmbeddingResponse, RequestOptions } from '../core/types';

export async function createEmbedding(
  config: ResolvedConfig,
  request: CreateEmbeddingRequest,
  options?: RequestOptions
): Promise<CreateEmbeddingResponse | { data: CreateEmbeddingResponse; response: Response }> {
  validateEmbeddingRequest(request);
  const body = JSON.stringify(request);
  const response = await runRequest(config, config.apiPaths.Embeddings, { method: 'POST', body }, options);
  const data = (await response.json()) as CreateEmbeddingResponse;
  if (options?.withResponse) return { data, response };
  return data;
}
