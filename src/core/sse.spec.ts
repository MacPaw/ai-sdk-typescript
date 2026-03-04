import { describe, it, expect } from 'vitest';
import { parseSSE, parseSSEAsJSON } from './sse';
import { AIGatewayError } from './errors';

function streamFromStrings(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const text = lines.join('\n') + '\n';
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe('parseSSE', () => {
  it('yields data lines and stops at [DONE]', async () => {
    const stream = streamFromStrings(['data: {"x":1}', 'data: {"x":2}', 'data: [DONE]']);
    const chunks: string[] = [];
    for await (const chunk of parseSSE(stream)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['{"x":1}', '{"x":2}']);
  });

  it('yields single data line', async () => {
    const stream = streamFromStrings(['data: hello']);
    const chunks: string[] = [];
    for await (const chunk of parseSSE(stream)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['hello']);
  });

  it('ignores non-data lines', async () => {
    const stream = streamFromStrings(['event: ping', 'data: {"ok":true}', 'data: [DONE]']);
    const chunks: string[] = [];
    for await (const chunk of parseSSE(stream)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['{"ok":true}']);
  });

  it('throws AIGatewayError on error events', async () => {
    const stream = streamFromStrings([
      'data: {"x":1}',
      'event: error',
      'data: {"message":"Stream failed","code":"INTERNAL_SERVER_ERROR","statusCode":500}',
    ]);
    const chunks: string[] = [];
    await expect(async () => {
      for await (const chunk of parseSSE(stream)) {
        chunks.push(chunk);
      }
    }).rejects.toThrow(AIGatewayError);
    expect(chunks).toEqual(['{"x":1}']);
  });

  it('handles error event with unparseable JSON', async () => {
    const stream = streamFromStrings([
      'event: error',
      'data: not-json',
    ]);
    await expect(async () => {
      for await (const chunk of parseSSE(stream)) void chunk;
    }).rejects.toThrow(AIGatewayError);
  });

  it('throws AIGatewayError when trailing buffer is an error event without trailing newline', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // No trailing \n after the data line — forces it into the buffer path
        controller.enqueue(encoder.encode('event: error\ndata: {"message":"final error","statusCode":503}'));
        controller.close();
      },
    });
    await expect(async () => {
      for await (const chunk of parseSSE(stream)) void chunk;
    }).rejects.toThrow(AIGatewayError);
  });
});

describe('parseSSEAsJSON', () => {
  it('parses JSON chunks', async () => {
    const stream = streamFromStrings(['data: {"id":"a","choices":[]}', 'data: [DONE]']);
    const chunks: { id: string }[] = [];
    for await (const chunk of parseSSEAsJSON<{ id: string }>(stream)) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].id).toBe('a');
  });

  it('skips malformed JSON with logger warning', async () => {
    const warns: unknown[] = [];
    const logger = { warn: (...args: unknown[]) => warns.push(args) };
    const stream = streamFromStrings(['data: not-json', 'data: {"ok":true}', 'data: [DONE]']);
    const chunks: { ok: boolean }[] = [];
    for await (const chunk of parseSSEAsJSON<{ ok: boolean }>(stream, logger)) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].ok).toBe(true);
    expect(warns.length).toBeGreaterThan(0);
  });
});
