import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAIGatewayFetch } from './create-fetch';

describe('createAIGatewayFetch', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('ok', { status: 200 }),
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('injects Bearer token from getAuthToken', async () => {
    const customFetch = createAIGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'my-jwt',
    });

    await customFetch('https://api.macpaw.com/ai/api/v1/chat/completions', {
      method: 'POST',
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = fetchCall[1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer my-jwt');
  });

  it('resolves relative URLs against baseURL', async () => {
    const customFetch = createAIGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
    });

    await customFetch('/api/v1/chat/completions');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.macpaw.com/ai/api/v1/chat/completions');
  });

  it('passes extra headers', async () => {
    const customFetch = createAIGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
      headers: { 'X-Custom': 'value' },
    });

    await customFetch('https://api.macpaw.com/ai/test');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = fetchCall[1].headers as Headers;
    expect(headers.get('X-Custom')).toBe('value');
  });

  it('skips Authorization when token is null', async () => {
    const customFetch = createAIGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
    });

    await customFetch('https://api.macpaw.com/ai/test');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = fetchCall[1].headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
  });
});
