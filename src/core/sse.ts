/**
 * SSE (Server-Sent Events) parser for streaming responses.
 * Consumes ReadableStream and yields parsed JSON chunks (data: {...} lines).
 *
 * Handles:
 * - Standard data: lines with [DONE] terminator
 * - Error events (event: error) thrown as AIGatewayError
 * - Proper reader cleanup on abort/break
 * - Logging of malformed JSON chunks
 */

import type { Logger } from './config';
import { AIGatewayError } from './errors';
import { ErrorCode } from './types';

export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, undefined> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
          continue;
        }
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;

          if (currentEvent === 'error') {
            // Reset before throwing so the event tag doesn't leak if
            // this code is ever restructured to continue instead of throw.
            currentEvent = '';
            try {
              const errorPayload = JSON.parse(data);
              // JSON parsed OK — throw a rich error with server-provided details.
              throw new AIGatewayError(
                errorPayload.message ?? 'Stream error',
                errorPayload.code ?? ErrorCode.InternalServerError,
                errorPayload.statusCode ?? 500,
                errorPayload.metadata ?? {},
              );
            } catch (err) {
              // Re-throw AIGatewayError from above; wrap JSON parse failures
              // in a generic error so the stream always surfaces something useful.
              if (err instanceof AIGatewayError) throw err;
              throw new AIGatewayError('Stream error', ErrorCode.InternalServerError, 500);
            }
          }

          currentEvent = '';
          yield data;
        }
        if (line.trim() === '') {
          currentEvent = '';
        }
      }
    }
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6).trim();
      if (data !== '[DONE]') yield data;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader may already be released if stream was cancelled
    }
  }
}

export async function* parseSSEAsJSON<T>(
  stream: ReadableStream<Uint8Array>,
  logger?: Logger
): AsyncGenerator<T, void, undefined> {
  for await (const chunk of parseSSE(stream)) {
    try {
      yield JSON.parse(chunk) as T;
    } catch (err) {
      logger?.warn?.('[ai-gateway-sdk] SSE JSON parse error', chunk, err);
    }
  }
}
