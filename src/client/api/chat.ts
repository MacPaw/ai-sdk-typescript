/**
 * Chat Completions API facade.
 */

import type { ResolvedConfig } from '../../runtime/config';
import { runRequest } from '../../runtime/request';
import { assertSSEResponse, parseSSEAsJSON } from '../../runtime/sse';
import { validateChatCompletionRequest } from '../../runtime/validation';
import type { CreateChatCompletionRequest, ChatCompletion, ChatCompletionChunk, RequestOptions } from '../../types';

export async function createChatCompletion(
  config: ResolvedConfig,
  request: CreateChatCompletionRequest,
  options?: RequestOptions,
): Promise<ChatCompletion> {
  validateChatCompletionRequest(request);
  const body = JSON.stringify(request);
  const response = await runRequest(config, config.apiPaths.ChatCompletions, { method: 'POST', body }, options);
  return (await response.json()) as ChatCompletion;
}

export async function* createChatCompletionStream(
  config: ResolvedConfig,
  request: CreateChatCompletionRequest,
  options?: RequestOptions,
): AsyncGenerator<ChatCompletionChunk, void, undefined> {
  validateChatCompletionRequest(request);
  const streamRequest = { ...request, stream: true };
  const body = JSON.stringify(streamRequest);
  const response = await runRequest(config, config.apiPaths.ChatCompletions, { method: 'POST', body }, options);
  const stream = await assertSSEResponse(response);
  yield* parseSSEAsJSON<ChatCompletionChunk>(stream, config.logger);
}
