import { describe, it, expect, vi } from 'vitest';
import { createChatCompletion, createChatCompletionStream } from '../chat';
import type { ResolvedConfig } from '../../../runtime/config';
import { API_PATHS } from '../../../runtime/paths';

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

describe('createChatCompletion', () => {
  it('sends POST to /api/v1/chat/completions and parses JSON', async () => {
    const completion = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1700000000,
      model: 'openai/gpt-4.1-nano',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
    };
    const response = new Response(JSON.stringify(completion), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);

    const result = await createChatCompletion(config, {
      model: 'openai/gpt-4.1-nano',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.id).toBe('chatcmpl-123');
    expect(result.choices[0].message?.content).toBe('Hello!');

    const transport = config.transport!;
    expect(transport.request).toHaveBeenCalledTimes(1);
    const req = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.url).toContain('/api/v1/chat/completions');
    expect(req.method).toBe('POST');
  });
});

describe('createChatCompletionStream', () => {
  it('streams SSE chunks and yields parsed JSON', async () => {
    const sseData =
      [
        'data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"delta":{"role":"assistant"},"finish_reason":null,"index":0}]}',
        'data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"delta":{"content":"Hi"},"finish_reason":null,"index":0}]}',
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

    const chunks = [];
    for await (const chunk of createChatCompletionStream(config, {
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0].choices[0].delta?.role).toBe('assistant');
    expect(chunks[1].choices[0].delta?.content).toBe('Hi');
  });

  it('throws clear error when server returns JSON instead of SSE stream', async () => {
    const errorBody = { error: { message: 'Model overloaded', type: 'api_error' } };
    const response = new Response(JSON.stringify(errorBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of createChatCompletionStream(config, {
        model: 'm',
        messages: [{ role: 'user', content: 'x' }],
      })) {
        /* consume */
      }
    }).rejects.toThrow('Expected SSE stream but received JSON response');
  });
});
