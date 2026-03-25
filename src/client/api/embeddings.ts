/**
 * Embeddings API facade.
 */

import type { ResolvedConfig } from '../../runtime/config';
import { runRequest } from '../../runtime/request';
import { validateEmbeddingRequest } from '../../runtime/validation';
import type { CreateEmbeddingRequest, CreateEmbeddingResponse, RequestOptions } from '../../types';

type InternalRequestOptions = RequestOptions & { withResponse?: boolean };

export async function createEmbedding(
  config: ResolvedConfig,
  request: CreateEmbeddingRequest,
  options?: InternalRequestOptions,
): Promise<CreateEmbeddingResponse | { data: CreateEmbeddingResponse; response: Response }> {
  validateEmbeddingRequest(request);
  const body = JSON.stringify(request);
  const response = await runRequest(config, config.apiPaths.Embeddings, { method: 'POST', body }, options);
  const data = (await response.json()) as CreateEmbeddingResponse;
  if (options?.withResponse) return { data, response };
  return data;
}
