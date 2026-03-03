/**
 * Model info API facade.
 */

import type { ResolvedConfig } from '../core/config';
import { runRequest } from '../core/request';
import { API_PATHS } from '../core/paths';
import type { ModelInfoResponse, RequestOptions } from '../core/types';

export async function getModelInfo(
  config: ResolvedConfig,
  params?: { litellm_model_id?: string },
  options?: RequestOptions
): Promise<ModelInfoResponse | { data: ModelInfoResponse; response: Response }> {
  const query = params?.litellm_model_id
    ? `?litellm_model_id=${encodeURIComponent(params.litellm_model_id)}`
    : '';
  const response = await runRequest(config, `${API_PATHS.ModelInfo}${query}`, { method: 'GET' }, options);
  const data = (await response.json()) as ModelInfoResponse;
  if (options?.withResponse) return { data, response };
  return data;
}
