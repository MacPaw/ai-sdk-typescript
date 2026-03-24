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
 * Throws `AIGatewayError` if the server returned JSON or an unexpected type,
 * so consumers can catch it consistently via `isAIGatewayError`.
 */
export async function assertSSEResponse(response: Response): Promise<ReadableStream<Uint8Array>> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new AIGatewayError(
      `Expected SSE stream but received JSON response. ` +
        `This usually means the server rejected the streaming request. ` +
        `Body: ${JSON.stringify(body).slice(0, 300)}`,
      ErrorCode.BadRequest,
      response.status || 400,
    );
  }
  if (!contentType.includes('text/event-stream')) {
    const text = await response.text().catch(() => '');
    throw new AIGatewayError(
      `Unexpected content type: ${contentType}. Body: ${text.slice(0, 200)}`,
      ErrorCode.BadRequest,
      response.status || 400,
    );
  }
  const stream = response.body;
  if (!stream) {
    throw new AIGatewayError('No response body for SSE stream', ErrorCode.InternalServerError, 500);
  }
  return stream;
}

/**
 * Extract field value after `field:` prefix.
 * Per SSE spec: if there's a space after the colon, strip it (only the first one).
 */
function extractFieldValue(line: string, colonOffset: number): string {
  return line[colonOffset] === ' ' ? line.slice(colonOffset + 1) : line.slice(colonOffset);
}

function isCompleteSSEPayload(data: string): boolean {
  if (data === '[DONE]') return true;
  try {
    JSON.parse(data);
    return true;
  } catch {
    return false;
  }
}

export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, undefined> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let currentDataLines: string[] = [];

  const flushEvent = (): { done: boolean; data?: string } => {
    if (currentDataLines.length === 0) {
      currentEvent = '';
      return { done: false };
    }

    const data = currentDataLines.join('\n');
    const event = currentEvent;
    currentDataLines = [];
    currentEvent = '';

    if (data === '[DONE]') {
      return { done: true };
    }

    if (event === 'error') {
      throwStreamError(data);
    }

    return { done: false, data };
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r\n|\r|\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith(':')) {
          continue;
        }
        if (line.startsWith('event:')) {
          if (currentDataLines.length > 0 && isCompleteSSEPayload(currentDataLines.join('\n'))) {
            const event = flushEvent();
            if (event.done) return;
            if (event.data !== undefined) {
              yield event.data;
            }
          }
          currentEvent = extractFieldValue(line, 6);
          continue;
        }
        if (line.startsWith('data:')) {
          const nextDataLine = extractFieldValue(line, 5);
          if (
            currentDataLines.length > 0 &&
            (isCompleteSSEPayload(currentDataLines.join('\n')) || isCompleteSSEPayload(nextDataLine))
          ) {
            const event = flushEvent();
            if (event.done) return;
            if (event.data !== undefined) {
              yield event.data;
            }
          }
          currentDataLines.push(nextDataLine);
          continue;
        }
        if (line.trim() === '') {
          const event = flushEvent();
          if (event.done) return;
          if (event.data !== undefined) {
            yield event.data;
          }
        }
      }
    }

    if (buffer.length > 0) {
      if (buffer.startsWith(':')) {
        buffer = '';
      } else if (buffer.startsWith('event:')) {
        currentEvent = extractFieldValue(buffer, 6);
      } else if (buffer.startsWith('data:')) {
        currentDataLines.push(extractFieldValue(buffer, 5));
      }
    }

    const event = flushEvent();
    if (event.done) return;
    if (event.data !== undefined) {
      yield event.data;
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
