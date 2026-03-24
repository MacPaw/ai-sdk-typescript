/**
 * Model info API facade.
 */

import type { ResolvedConfig } from '../../runtime/config';
import { runRequest } from '../../runtime/request';
import { validateModelInfoParams } from '../../runtime/validation';
import type { ModelInfoResponse, RequestOptions } from '../../types';

export async function getModelInfo(
  config: ResolvedConfig,
  params?: { litellm_model_id?: string },
  options?: RequestOptions,
): Promise<ModelInfoResponse | { data: ModelInfoResponse; response: Response }> {
  validateModelInfoParams(params);
  const query = params?.litellm_model_id ? `?litellm_model_id=${encodeURIComponent(params.litellm_model_id)}` : '';
  const response = await runRequest(config, `${config.apiPaths.ModelInfo}${query}`, { method: 'GET' }, options);
  const data = (await response.json()) as ModelInfoResponse;
  if (options?.withResponse) return { data, response };
  return data;
}
