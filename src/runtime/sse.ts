/**
 * SSE (Server-Sent Events) parser for streaming responses.
 * Consumes ReadableStream and yields parsed JSON chunks (data: {...} lines).
 *
 * Handles:
 * - Standard data: lines with [DONE] terminator
 * - Error events (event: error) thrown as normalized AIGatewayError subclasses
 * - Proper reader cleanup on abort/break
 * - Logging of malformed JSON chunks
 */

import type { Logger } from './config';
import { AIGatewayError, parseStreamErrorPayload } from './errors';
import { ErrorCode } from '../types';

function throwStreamError(data: string): never {
  try {
    const payload = JSON.parse(data);
    throw parseStreamErrorPayload(payload);
  } catch (err) {
    if (err instanceof AIGatewayError) throw err;
    throw new AIGatewayError('Stream error', ErrorCode.InternalServerError, 500, {}, { cause: err });
  }
}

/**
 * Validate that a streaming response has the expected SSE content type.
 * Throws a descriptive error if the server returned JSON or an unexpected type.
 */
export async function assertSSEResponse(response: Response): Promise<ReadableStream<Uint8Array>> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await response.json();
    throw new Error(
      `Expected SSE stream but received JSON response. ` +
        `This usually means the server rejected the streaming request. ` +
        `Body: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  if (!contentType.includes('text/event-stream')) {
    const text = await response.text();
    throw new Error(`Unexpected content type: ${contentType}. Body: ${text.slice(0, 200)}`);
  }
  const stream = response.body;
  if (!stream) throw new Error('No response body');
  return stream;
}

/**
 * Extract field value after `field:` prefix.
 * Per SSE spec: if there's a space after the colon, strip it (only the first one).
 */
function extractFieldValue(line: string, colonOffset: number): string {
  return (line[colonOffset] === ' ' ? line.slice(colonOffset + 1) : line.slice(colonOffset)).trim();
}

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
      const lines = buffer.split(/\r\n|\r|\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = extractFieldValue(line, 6);
          continue;
        }
        if (line.startsWith('data:')) {
          const data = extractFieldValue(line, 5);
          if (data === '[DONE]') return;

          if (currentEvent === 'error') {
            currentEvent = '';
            throwStreamError(data);
          }

          currentEvent = '';
          yield data;
        }
        if (line.trim() === '') {
          currentEvent = '';
        }
      }
    }
    if (buffer.startsWith('data:')) {
      const data = extractFieldValue(buffer, 5);
      if (data === '[DONE]') return;
      if (currentEvent === 'error') throwStreamError(data);
      yield data;
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
  logger?: Logger,
): AsyncGenerator<T, void, undefined> {
  for await (const chunk of parseSSE(stream)) {
    try {
      yield JSON.parse(chunk) as T;
    } catch (err) {
      logger?.warn?.('[ai-gateway-sdk] SSE JSON parse error', chunk, err);
    }
  }
}
