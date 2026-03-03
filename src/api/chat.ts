/**
 * Chat Completions API facade.
 */

import type { ResolvedConfig } from '../core/config';
import { runRequest } from '../core/request';
import { parseSSEAsJSON } from '../core/sse';
import { validateChatCompletionRequest } from '../core/validation';
import { API_PATHS } from '../core/paths';
import type {
  CreateChatCompletionRequest,
  ChatCompletion,
  ChatCompletionChunk,
  RequestOptions,
} from '../core/types';

export async function createChatCompletion(
  config: ResolvedConfig,
  request: CreateChatCompletionRequest,
  options?: RequestOptions
): Promise<ChatCompletion | { data: ChatCompletion; response: Response }> {
  validateChatCompletionRequest(request);
  const body = JSON.stringify(request);
  const response = await runRequest(config, API_PATHS.ChatCompletions, { method: 'POST', body }, options);
  const data = (await response.json()) as ChatCompletion;
  if (options?.withResponse) return { data, response };
  return data;
}

export async function* createChatCompletionStream(
  config: ResolvedConfig,
  request: CreateChatCompletionRequest,
  options?: RequestOptions
): AsyncGenerator<ChatCompletionChunk, void, undefined> {
  validateChatCompletionRequest(request);
  const streamRequest = { ...request, stream: true };
  const body = JSON.stringify(streamRequest);
  const response = await runRequest(config, API_PATHS.ChatCompletions, { method: 'POST', body }, options);
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('text/event-stream') && !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Unexpected content type: ${contentType}. Body: ${text.slice(0, 200)}`);
  }
  const stream = response.body;
  if (!stream) throw new Error('No response body');
  yield* parseSSEAsJSON<ChatCompletionChunk>(stream, config.logger);
}
