/**
 * Images API facade (generation and editing).
 */

import type { ResolvedConfig } from '../../runtime/config';
import { runRequest } from '../../runtime/request';
import { validateImageGenerationRequest, validateImageEditRequest } from '../../runtime/validation';
import type { CreateImageRequest, CreateImageResponse, CreateImageEditRequest, RequestOptions } from '../../types';

export async function createImage(
  config: ResolvedConfig,
  request: CreateImageRequest,
  options?: RequestOptions,
): Promise<CreateImageResponse> {
  validateImageGenerationRequest(request);
  const body = JSON.stringify(request);
  const response = await runRequest(config, config.apiPaths.ImagesGenerations, { method: 'POST', body }, options);
  return (await response.json()) as CreateImageResponse;
}

export async function createImageEdit(
  config: ResolvedConfig,
  request: CreateImageEditRequest,
  options?: RequestOptions,
): Promise<CreateImageResponse> {
  validateImageEditRequest(request);
  const formData = new FormData();
  formData.append('image', request.image);
  formData.append('prompt', request.prompt);
  if (request.model) formData.append('model', request.model);
  if (request.mask) formData.append('mask', request.mask);
  if (request.n != null) formData.append('n', String(request.n));
  if (request.size) formData.append('size', request.size);
  if (request.response_format) formData.append('response_format', request.response_format);

  const response = await runRequest(config, config.apiPaths.ImagesEdits, { method: 'POST', body: formData }, options);
  return (await response.json()) as CreateImageResponse;
}
