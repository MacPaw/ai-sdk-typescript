import { describe, it, expect, vi } from 'vitest';
import { createAIGatewayClient } from '../client';
import type { Middleware, RequestConfig } from '../runtime/config';
import { createMockTransport } from '../testing/mock-transport';

describe('createAIGatewayClient', () => {
  it('throws if neither baseURL nor env is provided', () => {
    expect(() => createAIGatewayClient({ getAuthToken: async () => 'token' })).toThrow(
      'AIGatewayClient requires baseURL or env',
    );
  });

  it('creates client with baseURL', () => {
    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'token',
    });
    expect(client.chat.completions).toBeDefined();
    expect(client.responses).toBeDefined();
    expect(client.embeddings).toBeDefined();
    expect(client.models).toBeDefined();
    expect(client.images).toBeDefined();
    expect(client.audio).toBeDefined();
  });

  it('creates client with env=production', () => {
    const client = createAIGatewayClient({
      env: 'production',
      getAuthToken: async () => 'token',
    });
    expect(client.chat.completions).toBeDefined();
  });

  it('creates client with explicit baseURL for non-production', () => {
    const client = createAIGatewayClient({
      baseURL: 'https://staging.example.com/ai',
      getAuthToken: async () => 'token',
    });
    expect(client.chat.completions).toBeDefined();
  });

  it('use() adds middleware without unsafe casts', () => {
    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'token',
    });
    const mw: Middleware = vi.fn(async (config: RequestConfig, next) => next(config));
    client.use(mw);
    expect(mw).not.toHaveBeenCalled();
  });

  it('all API namespaces have expected methods', () => {
    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'token',
    });

    expect(typeof client.chat.completions.create).toBe('function');
    expect(typeof client.chat.completions.createWithResponse).toBe('function');
    expect(typeof client.chat.completions.stream).toBe('function');
    expect(typeof client.responses.create).toBe('function');
    expect(typeof client.responses.createWithResponse).toBe('function');
    expect(typeof client.responses.createStream).toBe('function');
    expect(typeof client.responses.stream).toBe('function');
    expect(typeof client.embeddings.create).toBe('function');
    expect(typeof client.embeddings.createWithResponse).toBe('function');
    expect(typeof client.models.getInfo).toBe('function');
    expect(typeof client.models.getInfoWithResponse).toBe('function');
    expect(typeof client.images.generate).toBe('function');
    expect(typeof client.images.generateWithResponse).toBe('function');
    expect(typeof client.images.edit).toBe('function');
    expect(typeof client.images.editWithResponse).toBe('function');
    expect(typeof client.audio.transcriptions.create).toBe('function');
    expect(typeof client.audio.transcriptions.createWithResponse).toBe('function');
    expect(typeof client.audio.translations.create).toBe('function');
    expect(typeof client.audio.translations.createWithResponse).toBe('function');
  });

  it('chat.completions.stream uses the client pipeline and injects stream usage options', async () => {
    const transport = createMockTransport();
    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'token',
      transport,
    });

    const result = client.chat.completions.stream({
      model: 'openai/gpt-4.1-nano',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    await expect(result.text).resolves.toBe('Mock response');
    expect(transport.requestCount).toBe(1);
    expect(transport.requests[0].body).toEqual({
      model: 'openai/gpt-4.1-nano',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  it('responses.stream uses default SSE transport fixtures', async () => {
    const transport = createMockTransport();
    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'token',
      transport,
    });

    const result = client.responses.stream({
      model: 'openai/gpt-4.1-nano',
      input: 'Hi',
    });

    await expect(result.text).resolves.toBe('Mock response');
    expect(transport.requestCount).toBe(1);
    expect(transport.requests[0].body).toEqual({
      model: 'openai/gpt-4.1-nano',
      input: 'Hi',
      stream: true,
    });
  });

  it('createWithResponse methods return data plus raw response', async () => {
    const transport = createMockTransport();
    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'token',
      transport,
    });

    const result = await client.models.getInfoWithResponse();

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('response');
    expect(result.response).toBeInstanceOf(Response);
  });

  it('rejects stream:true for createWithResponse methods that are non-streaming only', async () => {
    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'token',
    });

    expect(() =>
      client.chat.completions.createWithResponse({
        model: 'openai/gpt-4.1-nano',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
      } as never),
    ).toThrow('chat.completions.createWithResponse does not support stream: true');

    expect(() =>
      client.audio.transcriptions.createWithResponse({
        file: new Blob(['audio'], { type: 'audio/mp3' }),
        model: 'whisper-1',
        stream: true,
      } as never),
    ).toThrow('audio.transcriptions.createWithResponse does not support stream: true');

    expect(() =>
      client.responses.createWithResponse({
        model: 'openai/gpt-4.1-nano',
        input: 'Hi',
        stream: true,
      } as never),
    ).toThrow('responses.createWithResponse does not support stream: true');
  });
});
