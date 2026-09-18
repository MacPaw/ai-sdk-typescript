import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVoiceClient } from '../gateway-voices';
import { AIGatewayError, AuthError, RateLimitError } from '../gateway-errors';
import { DEFAULT_BASE_URLS } from '../gateway-config';

const BASE_URL = 'https://api.macpaw.com/ai';

const mockVoicesListResponse = {
  voices: [
    { voice_id: 'voice_1', name: 'Alice' },
    { voice_id: 'voice_2', name: 'Bob' },
  ],
  has_more: false,
  total_count: 2,
  next_page_token: '',
};

function makeVoicesListResponseObj(body = mockVoicesListResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createVoiceClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeVoicesListResponseObj());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ─── createVoiceClient() — factory options ────────────────────────────────

  describe('factory options', () => {
    it('accepts env: "production" and resolves the production base URL', async () => {
      const client = createVoiceClient({
        env: 'production',
        getAuthToken: async () => 'my-jwt',
      });

      await client.list({ provider: 'elevenlabs' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain(`${DEFAULT_BASE_URLS.production}/v1/voices`);
    });

    it('throws when neither baseURL nor env is provided', () => {
      expect(() =>
        createVoiceClient({
          getAuthToken: async () => 'token',
        }),
      ).toThrow(/requires baseURL or env/);
    });
  });

  // ─── list() ───────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('sends GET to /v1/voices with Authorization header and provider param', async () => {
      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'my-jwt',
      });

      await client.list({ provider: 'elevenlabs' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${BASE_URL}/v1/voices?provider=elevenlabs`);
      expect(fetchCall[1].method).toBe('GET');
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer my-jwt');
    });

    it('forwards provider query param in the request URL', async () => {
      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.list({ provider: 'elevenlabs' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('provider')).toBe('elevenlabs');
    });

    it('forwards a provider not yet known to the SDK without type or runtime changes', async () => {
      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.list({ provider: 'some-future-provider' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('provider')).toBe('some-future-provider');
    });

    it('forwards next_page_token query param when provided', async () => {
      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.list({ provider: 'elevenlabs', next_page_token: 'tok_abc123' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('provider')).toBe('elevenlabs');
      expect(url.searchParams.get('next_page_token')).toBe('tok_abc123');
    });

    it('does not include next_page_token when not provided', async () => {
      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.list({ provider: 'elevenlabs' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.has('next_page_token')).toBe(false);
    });

    it('parses and returns the VoicesListResponse', async () => {
      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const result = await client.list({ provider: 'elevenlabs' });

      expect(result.voices).toHaveLength(2);
      expect(result.voices[0].voice_id).toBe('voice_1');
      expect(result.voices[1].voice_id).toBe('voice_2');
      expect(result.has_more).toBe(false);
      expect(result.total_count).toBe(2);
    });

    it('throws AuthError on 401 with gateway error body', async () => {
      const unauthorized = new Response(
        JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
      // Auth retry fires once — both attempts must return 401 to surface the AuthError.
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(
        new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'stale-token',
      });

      await expect(client.list({ provider: 'elevenlabs' })).rejects.toBeInstanceOf(AuthError);
    });

    it('throws RateLimitError on 429', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(client.list({ provider: 'elevenlabs' })).rejects.toBeInstanceOf(RateLimitError);
    });

    it('throws AIGatewayError when the 200 response body is not valid JSON', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('not-json', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );

      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(client.list({ provider: 'elevenlabs' })).rejects.toBeInstanceOf(AIGatewayError);
    });
  });

  // ─── Auth / pipeline integration ──────────────────────────────────────────

  describe('auth / pipeline integration', () => {
    it('injects Bearer token via list()', async () => {
      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'bearer-for-list',
      });

      await client.list({ provider: 'elevenlabs' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer bearer-for-list');
    });

    it('retries list() with fresh token on stale 401', async () => {
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
        .mockResolvedValueOnce(makeVoicesListResponseObj());

      const client = createVoiceClient({
        baseURL: BASE_URL,
        getAuthToken,
      });

      await client.list({ provider: 'elevenlabs' });

      expect(getAuthToken).toHaveBeenNthCalledWith(1, false);
      expect(getAuthToken).toHaveBeenNthCalledWith(2, true);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    });
  });
});
