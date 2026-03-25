import { describe, it, expect } from 'vitest';
import { parseSSE, parseSSEAsJSON, AIGatewayError, AuthError, RateLimitError } from '../index';

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

  it('handles data: without trailing space (spec-compliant)', async () => {
    const stream = streamFromStrings(['data:{"compact":true}', 'data: [DONE]']);
    const chunks: string[] = [];
    for await (const chunk of parseSSE(stream)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['{"compact":true}']);
  });

  it('handles event: without trailing space', async () => {
    const stream = streamFromStrings(['event:error', 'data: {"message":"fail","statusCode":500}']);
    await expect(async () => {
      for await (const chunk of parseSSE(stream)) void chunk;
    }).rejects.toThrow(AIGatewayError);
  });

  it('ignores non-data lines', async () => {
    const stream = streamFromStrings(['event: ping', 'data: {"ok":true}', 'data: [DONE]']);
    const chunks: string[] = [];
    for await (const chunk of parseSSE(stream)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['{"ok":true}']);
  });

  it('handles \r\n line endings', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"a":1}\r\ndata: {"a":2}\r\ndata: [DONE]\r\n'));
        controller.close();
      },
    });
    const chunks: string[] = [];
    for await (const chunk of parseSSE(stream)) chunks.push(chunk);
    expect(chunks).toEqual(['{"a":1}', '{"a":2}']);
  });

  it('merges multi-line data fields into a single SSE event', async () => {
    const stream = streamFromStrings(['data: {"a":1,', 'data: "b":2}', '', 'data: [DONE]']);
    const chunks: string[] = [];
    for await (const chunk of parseSSE(stream)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['{"a":1,\n"b":2}']);
  });

  it('handles bare \r line endings', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"a":1}\rdata: {"a":2}\rdata: [DONE]\r'));
        controller.close();
      },
    });
    const chunks: string[] = [];
    for await (const chunk of parseSSE(stream)) chunks.push(chunk);
    expect(chunks).toEqual(['{"a":1}', '{"a":2}']);
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
    const stream = streamFromStrings(['event: error', 'data: not-json']);
    await expect(async () => {
      for await (const chunk of parseSSE(stream)) void chunk;
    }).rejects.toThrow(AIGatewayError);
  });

  it('throws typed AuthError subclass for UNAUTHORIZED stream error', async () => {
    const stream = streamFromStrings([
      'event: error',
      'data: {"message":"Token expired","code":"UNAUTHORIZED","statusCode":401}',
    ]);
    try {
      for await (const chunk of parseSSE(stream)) void chunk;
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe('AUTH_REQUIRED');
    }
  });

  it('throws typed RateLimitError subclass for RATE_LIMIT_EXCEEDED stream error', async () => {
    const stream = streamFromStrings([
      'event: error',
      'data: {"message":"Slow down","code":"RATE_LIMIT_EXCEEDED","statusCode":429,"metadata":{"retryAfter":30}}',
    ]);
    try {
      for await (const chunk of parseSSE(stream)) void chunk;
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfter).toBe(30);
    }
  });

  it('throws AIGatewayError when trailing buffer is an error event without trailing newline', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
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

  it('parses multi-line JSON SSE payloads', async () => {
    const stream = streamFromStrings(['data: {"id":"a",', 'data: "ok":true}', '', 'data: [DONE]']);
    const chunks: Array<{ id: string; ok: boolean }> = [];
    for await (const chunk of parseSSEAsJSON<{ id: string; ok: boolean }>(stream)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([{ id: 'a', ok: true }]);
  });
});
