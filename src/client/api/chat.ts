/**
 * Chat Completions API facade.
 */

import type { ResolvedConfig } from '../../runtime/config';
import { runRequest } from '../../runtime/request';
import { assertSSEResponse, parseSSEAsJSON } from '../../runtime/sse';
import { validateChatCompletionRequest } from '../../runtime/validation';
import type { CreateChatCompletionRequest, ChatCompletion, ChatCompletionChunk, RequestOptions } from '../../types';

type InternalRequestOptions = RequestOptions & { withResponse?: boolean };

export async function createChatCompletion(
  config: ResolvedConfig,
  request: CreateChatCompletionRequest,
  options?: InternalRequestOptions,
): Promise<ChatCompletion | { data: ChatCompletion; response: Response }> {
  validateChatCompletionRequest(request);
  const body = JSON.stringify(request);
  const response = await runRequest(config, config.apiPaths.ChatCompletions, { method: 'POST', body }, options);
  const data = (await response.json()) as ChatCompletion;
  if (options?.withResponse) return { data, response };
  return data;
}

export async function* createChatCompletionStream(
  config: ResolvedConfig,
  request: CreateChatCompletionRequest,
  options?: InternalRequestOptions,
): AsyncGenerator<ChatCompletionChunk, void, undefined> {
  validateChatCompletionRequest(request);
  const streamRequest = { ...request, stream: true };
  const body = JSON.stringify(streamRequest);
  const response = await runRequest(config, config.apiPaths.ChatCompletions, { method: 'POST', body }, options);
  const stream = await assertSSEResponse(response);
  yield* parseSSEAsJSON<ChatCompletionChunk>(stream, config.logger);
}
