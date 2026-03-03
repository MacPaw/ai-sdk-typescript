/**
 * Responses API facade (OpenAI Create Response format).
 */

import type { ResolvedConfig } from '../core/config';
import { runRequest } from '../core/request';
import { parseSSEAsJSON } from '../core/sse';
import { validateResponseRequest } from '../core/validation';
import type { CreateResponseRequest, ResponseObject, ResponseStreamEvent, RequestOptions } from '../core/types';

const PATH = '/api/v1/responses';

export async function createResponse(
  config: ResolvedConfig,
  request: CreateResponseRequest,
  options?: RequestOptions
): Promise<ResponseObject | { data: ResponseObject; response: Response }> {
  validateResponseRequest(request);
  const body = JSON.stringify(request);
  const response = await runRequest(config, PATH, { method: 'POST', body }, options);
  const data = (await response.json()) as ResponseObject;
  if (options?.withResponse) return { data, response };
  return data;
}

export async function* createResponseStream(
  config: ResolvedConfig,
  request: CreateResponseRequest,
  options?: RequestOptions
): AsyncGenerator<ResponseStreamEvent, void, undefined> {
  validateResponseRequest(request);
  const streamRequest = { ...request, stream: true };
  const body = JSON.stringify(streamRequest);
  const response = await runRequest(config, PATH, { method: 'POST', body }, options);
  const stream = response.body;
  if (!stream) throw new Error('No response body');
  yield* parseSSEAsJSON<ResponseStreamEvent>(stream, config.logger);
}
