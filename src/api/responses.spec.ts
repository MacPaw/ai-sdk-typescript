import { describe, it, expect, vi } from 'vitest';
import { createResponse, createResponseStream } from './responses';
import type { ResolvedConfig } from '../core/config';
import type { ResponseObject } from '../core/types';
import { API_PATHS } from '../core/paths';

function createMockConfig(response: Response): ResolvedConfig {
  return {
    baseURL: 'https://api.example.com/ai',
    getAuthToken: vi.fn().mockResolvedValue('token'),
    autoRefreshToken: false,
    tokenCacheTTL: 0,
    transport: { request: vi.fn().mockResolvedValue(response) },
    retry: false,
    middleware: [],
    timeout: 5000,
    logger: {},
    hooks: {},
    generateRequestId: false,
    apiPaths: API_PATHS,
  };
}

describe('createResponse', () => {
  it('returns typed ResponseObject', async () => {
    const responseObj = {
      id: 'resp_123',
      object: 'response',
      created_at: 1700000000,
      status: 'completed',
      model: 'openai/gpt-4.1-nano',
      output: [{
        type: 'message',
        id: 'msg_1',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: 'Hello!' }],
      }],
    };
    const response = new Response(JSON.stringify(responseObj), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);

    const raw = await createResponse(config, {
      model: 'openai/gpt-4.1-nano',
      input: 'Hi',
    });
    const result = ('response' in raw ? raw.data : raw) as ResponseObject;

    expect(result.id).toBe('resp_123');
    expect(result.status).toBe('completed');
    expect(result.output[0].content[0].text).toBe('Hello!');
  });
});

describe('createResponseStream', () => {
  it('streams SSE events as typed ResponseStreamEvent', async () => {
    const sseData = [
      'data: {"type":"response.created","response":{"id":"resp_1","status":"in_progress","object":"response","created_at":1,"model":"m","output":[]}}',
      'data: {"type":"response.output_text.delta","delta":"Hello"}',
      'data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","object":"response","created_at":1,"model":"m","output":[]}}',
      'data: [DONE]',
    ].join('\n') + '\n';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        controller.close();
      },
    });
    const response = new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    const config = createMockConfig(response);

    const events = [];
    for await (const event of createResponseStream(config, { model: 'm', input: 'x' })) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('response.created');
    expect(events[1].type).toBe('response.output_text.delta');
    expect(events[1].delta).toBe('Hello');
    expect(events[2].type).toBe('response.completed');
  });
});
