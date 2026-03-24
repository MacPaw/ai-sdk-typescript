import { describe, expect, it, vi } from 'vitest';
import { createAIGatewayClient } from '../client';
import { createMockTransport } from '../testing';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AIGatewayClient integration with mock transport', () => {
  it('refreshes auth and retries once after a 401 response', async () => {
    const transport = createMockTransport();
    const getAuthToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');

    let callCount = 0;
    transport.onRoute('/chat/completions', (config) => {
      callCount++;
      if (callCount === 1) {
        expect(config.headers.Authorization).toBe('Bearer stale-token');
        return jsonResponse({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
      }

      expect(config.headers.Authorization).toBe('Bearer fresh-token');
      return jsonResponse({
        id: 'chatcmpl-refreshed',
        object: 'chat.completion',
        created: 1,
        model: 'openai/gpt-4.1-nano',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Recovered' }, finish_reason: 'stop' }],
      });
    });

    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken,
      transport,
    });

    const result = await client.chat.completions.create({
      model: 'openai/gpt-4.1-nano',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.choices[0]?.message?.content).toBe('Recovered');
    expect(getAuthToken).toHaveBeenNthCalledWith(1, false);
    expect(getAuthToken).toHaveBeenNthCalledWith(2, true);
    expect(transport.requestCount).toBe(2);
  });

  it('runs middleware and lifecycle hooks through the real request pipeline', async () => {
    const transport = createMockTransport();
    const events: string[] = [];

    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'token',
      transport,
      middleware: [
        async (config, next) => {
          events.push(`middleware:${config.method}`);
          return next({
            ...config,
            headers: { ...config.headers, 'X-Test-Middleware': 'enabled' },
          });
        },
      ],
      hooks: {
        onRequest: (config) => {
          events.push(`request:${config.headers['X-Test-Middleware']}`);
        },
        onResponse: (_config, response) => {
          events.push(`response:${response.status}`);
        },
      },
    });

    await client.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: 'hello',
    });

    expect(events).toEqual(['middleware:POST', 'request:enabled', 'response:200']);
    expect(transport.requestCount).toBe(1);
    expect(transport.requests[0].config.headers.Authorization).toBe('Bearer token');
    expect(transport.requests[0].config.headers['X-Test-Middleware']).toBe('enabled');
  });

  it('retries 503 responses and redacts auth headers in onRetry hooks', async () => {
    const transport = createMockTransport();
    const onRetry = vi.fn();
    let attempts = 0;

    transport.onRoute('/chat/completions', () => {
      attempts++;
      if (attempts === 1) {
        return jsonResponse({ statusCode: 503, message: 'Overloaded', code: 'INTERNAL_SERVER_ERROR' }, 503);
      }

      return jsonResponse({
        id: 'chatcmpl-retry',
        object: 'chat.completion',
        created: 1,
        model: 'openai/gpt-4.1-nano',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Recovered after retry' }, finish_reason: 'stop' }],
      });
    });

    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'secret-token',
      transport,
      retry: { maxAttempts: 2, initialDelayMs: 0, maxDelayMs: 0 },
      hooks: { onRetry },
    });

    const result = await client.chat.completions.create({
      model: 'openai/gpt-4.1-nano',
      messages: [{ role: 'user', content: 'Retry please' }],
    });

    expect(result.choices[0]?.message?.content).toBe('Recovered after retry');
    expect(transport.requestCount).toBe(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]?.[2]?.headers.Authorization).toBe('[REDACTED]');
  });

  it('captures multipart requests through the real client pipeline', async () => {
    const transport = createMockTransport();
    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'token',
      transport,
    });

    await client.audio.transcriptions.create({
      file: new Blob(['audio-data'], { type: 'audio/mp3' }),
      model: 'openai/gpt-4o-transcribe',
      language: 'en',
      timestamp_granularities: ['word', 'segment'],
    });

    expect(transport.requestCount).toBe(1);
    expect(transport.requests[0].body).toEqual({
      file: { kind: 'blob', name: 'blob', type: 'audio/mp3', size: 10 },
      model: 'openai/gpt-4o-transcribe',
      language: 'en',
      'timestamp_granularities[]': ['word', 'segment'],
    });
  });
});
