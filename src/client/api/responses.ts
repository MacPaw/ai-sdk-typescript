/**
 * Responses API facade (OpenAI Create Response format).
 */

import type { ResolvedConfig } from '../../runtime/config';
import { runRequest } from '../../runtime/request';
import { assertSSEResponse, parseSSEAsJSON } from '../../runtime/sse';
import { validateResponseRequest } from '../../runtime/validation';
import type { CreateResponseRequest, ResponseObject, ResponseStreamEvent, RequestOptions } from '../../types';

export async function createResponse(
  config: ResolvedConfig,
  request: CreateResponseRequest,
  options?: RequestOptions,
): Promise<ResponseObject | { data: ResponseObject; response: Response }> {
  validateResponseRequest(request);
  const body = JSON.stringify(request);
  const response = await runRequest(config, config.apiPaths.Responses, { method: 'POST', body }, options);
  const data = (await response.json()) as ResponseObject;
  if (options?.withResponse) return { data, response };
  return data;
}

export async function* createResponseStream(
  config: ResolvedConfig,
  request: CreateResponseRequest,
  options?: RequestOptions,
): AsyncGenerator<ResponseStreamEvent, void, undefined> {
  validateResponseRequest(request);
  const streamRequest = { ...request, stream: true };
  const body = JSON.stringify(streamRequest);
  const response = await runRequest(config, config.apiPaths.Responses, { method: 'POST', body }, options);
  const stream = await assertSSEResponse(response);
  yield* parseSSEAsJSON<ResponseStreamEvent>(stream, config.logger);
}
