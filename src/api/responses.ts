/**
 * Responses API facade (OpenAI Create Response format).
 */

import type { ResolvedConfig } from '../core/config';
import { runRequest } from '../core/request';
import { parseSSEAsJSON } from '../core/sse';
import { validateResponseRequest } from '../core/validation';
import type { CreateResponseRequest, ResponseObject, ResponseStreamEvent, RequestOptions } from '../core/types';

export async function createResponse(
  config: ResolvedConfig,
  request: CreateResponseRequest,
  options?: RequestOptions
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
  options?: RequestOptions
): AsyncGenerator<ResponseStreamEvent, void, undefined> {
  validateResponseRequest(request);
  const streamRequest = { ...request, stream: true };
  const body = JSON.stringify(streamRequest);
  const response = await runRequest(config, config.apiPaths.Responses, { method: 'POST', body }, options);
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await response.json();
    throw new Error(
      `Expected SSE stream but received JSON response. `
      + `This usually means the server rejected the streaming request. `
      + `Body: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  if (!contentType.includes('text/event-stream')) {
    const text = await response.text();
    throw new Error(`Unexpected content type: ${contentType}. Body: ${text.slice(0, 200)}`);
  }
  const stream = response.body;
  if (!stream) throw new Error('No response body');
  yield* parseSSEAsJSON<ResponseStreamEvent>(stream, config.logger);
}
