import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGatewayFetch } from '../gateway-fetch';
import { AIGatewayError } from '../gateway-errors';

describe('createGatewayFetch', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('injects Bearer token from getAuthToken', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'my-jwt',
    });

    await customFetch('https://api.macpaw.com/ai/api/v1/chat/completions', {
      method: 'POST',
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(fetchCall[1].headers);
    expect(headers.get('Authorization')).toBe('Bearer my-jwt');
  });

  it('resolves relative URLs against baseURL', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
    });

    await customFetch('/api/v1/chat/completions');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.macpaw.com/ai/api/v1/chat/completions');
  });

  it('passes extra headers', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
      headers: { 'X-Custom': 'value' },
    });

    await customFetch('https://api.macpaw.com/ai/test');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(fetchCall[1].headers);
    expect(headers.get('X-Custom')).toBe('value');
  });

  it('skips Authorization when token is null', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
    });

    await customFetch('https://api.macpaw.com/ai/test');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(fetchCall[1].headers);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('does not prefix absolute URLs to a different host', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'tok',
    });

    await customFetch('https://other.example.com/v1/models');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('https://other.example.com/v1/models');
  });

  it('does not leak Bearer token to external hosts', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'secret-token',
      headers: { 'X-Internal': 'yes' },
    });

    await customFetch('https://evil.example.com/steal');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(fetchCall[1].headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-Internal')).toBe(false);
  });

  it('strips the gateway placeholder Authorization header for external hosts', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'secret-token',
    });

    await customFetch(
      new Request('https://evil.example.com/steal', {
        headers: { Authorization: 'Bearer ai-gateway-auth-via-fetch' },
      }),
    );

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(fetchCall[1].headers);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('does not treat prefix-matching absolute URLs as gateway requests', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'secret-token',
      headers: { 'X-Internal': 'yes' },
    });

    await customFetch('https://api.macpaw.com/ai-staging/api/v1/chat/completions');

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(fetchCall[1].headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-Internal')).toBe(false);
  });

  it('does not set Content-Type for FormData body', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
    });

    const form = new FormData();
    form.append('file', new Blob(['audio']), 'audio.mp3');

    await customFetch('https://api.macpaw.com/ai/test', {
      method: 'POST',
      body: form,
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(fetchCall[1].headers);
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('does not set Content-Type for Blob body', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
    });

    const blob = new Blob(['binary data'], { type: 'application/octet-stream' });

    await customFetch('https://api.macpaw.com/ai/test', {
      method: 'POST',
      body: blob,
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(fetchCall[1].headers);
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('refreshes the token and retries once on 401', async () => {
    const getAuthToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');

    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken,
    });

    await customFetch('https://api.macpaw.com/ai/api/v1/chat/completions', { method: 'POST' });

    expect(getAuthToken).toHaveBeenNthCalledWith(1, false);
    expect(getAuthToken).toHaveBeenNthCalledWith(2, true);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('throws normalized gateway errors by default', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ statusCode: 402, message: 'No credits', code: 'INSUFFICIENT_CREDITS' }), {
        status: 402,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'token',
    });

    await expect(customFetch('https://api.macpaw.com/ai/api/v1/chat/completions')).rejects.toBeInstanceOf(
      AIGatewayError,
    );
  });

  it('returns the raw non-OK Response when normalizeErrors is false', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ statusCode: 429, message: 'Slow down', code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'token',
      normalizeErrors: false,
    });

    const response = await customFetch('https://api.macpaw.com/ai/api/v1/chat/completions');
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      statusCode: 429,
      message: 'Slow down',
      code: 'RATE_LIMITED',
    });
  });

  it('calls getAuthToken on every request (no caching)', async () => {
    const getAuthToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('token-1')
      .mockResolvedValueOnce('token-2');
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken,
    });

    await customFetch('https://api.macpaw.com/ai/test');
    await customFetch('https://api.macpaw.com/ai/test');

    expect(getAuthToken).toHaveBeenCalledTimes(2);
    const secondCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    const headers = new Headers(secondCall[1].headers);
    expect(headers.get('Authorization')).toBe('Bearer token-2');
  });

  it('runs provider fetch middleware through the shared request pipeline', async () => {
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
      middleware: [
        async (request, next) =>
          next({
            ...request,
            headers: {
              ...request.headers,
              'X-Middleware': 'applied',
            },
          }),
      ],
    });

    await customFetch('https://api.macpaw.com/ai/test', { method: 'GET' });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = fetchCall[1].headers as Record<string, string>;
    expect(headers['X-Middleware']).toBe('applied');
  });

  it('retries retryable gateway failures through the shared request pipeline', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ statusCode: 503, message: 'Unavailable', code: 'SERVICE_UNAVAILABLE' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'token',
      retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1 },
    });

    const response = await customFetch('https://api.macpaw.com/ai/api/v1/chat/completions', { method: 'POST' });
    expect(response.status).toBe(200);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('applies timeout through the shared request pipeline', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((resolve, reject) => {
          const signal = init?.signal;
          const id = setTimeout(() => resolve(new Response('ok', { status: 200 })), 5000);
          signal?.addEventListener('abort', () => {
            clearTimeout(id);
            reject(signal.reason);
          });
        }),
    );

    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'token',
      timeout: 50,
      retry: false,
    });

    await expect(customFetch('https://api.macpaw.com/ai/test', { method: 'GET' })).rejects.toThrow(/timed out/i);
  });

  it('uses a custom fetch implementation', async () => {
    const customFetchImpl = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const customFetch = createGatewayFetch({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'token',
      fetch: customFetchImpl,
    });

    const response = await customFetch('https://api.macpaw.com/ai/test', { method: 'GET' });

    expect(response.status).toBe(200);
    expect(customFetchImpl).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
