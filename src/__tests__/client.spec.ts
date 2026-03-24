import { describe, it, expect, vi } from 'vitest';
import { createAIGatewayClient } from '../client';
import type { Middleware, RequestConfig } from '../runtime/config';

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
    expect(typeof client.chat.completions.stream).toBe('function');
    expect(typeof client.responses.create).toBe('function');
    expect(typeof client.responses.createStream).toBe('function');
    expect(typeof client.responses.stream).toBe('function');
    expect(typeof client.embeddings.create).toBe('function');
    expect(typeof client.models.getInfo).toBe('function');
    expect(typeof client.images.generate).toBe('function');
    expect(typeof client.images.edit).toBe('function');
    expect(typeof client.audio.transcriptions.create).toBe('function');
    expect(typeof client.audio.translations.create).toBe('function');
  });
});
