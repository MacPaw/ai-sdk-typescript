/**
 * Embeddings API facade.
 */

import type { ResolvedConfig } from '../../runtime/config';
import { runRequest } from '../../runtime/request';
import { validateEmbeddingRequest } from '../../runtime/validation';
import type { CreateEmbeddingRequest, CreateEmbeddingResponse, RequestOptions } from '../../types';

export async function createEmbedding(
  config: ResolvedConfig,
  request: CreateEmbeddingRequest,
  options?: RequestOptions,
): Promise<CreateEmbeddingResponse> {
  validateEmbeddingRequest(request);
  const body = JSON.stringify(request);
  const response = await runRequest(config, config.apiPaths.Embeddings, { method: 'POST', body }, options);
  return (await response.json()) as CreateEmbeddingResponse;
}
