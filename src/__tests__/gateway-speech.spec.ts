import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpeechClient } from '../gateway-speech';
import { AIGatewayError, AuthError, RateLimitError } from '../gateway-errors';
import { DEFAULT_BASE_URLS } from '../gateway-config';

const BASE_URL = 'https://api.macpaw.com/ai';

const mockVoicesResponse = {
  data: [
    { id: 'alloy', name: 'Alloy', provider: 'openai' },
    { id: 'nova', name: 'Nova', provider: 'openai' },
  ],
};

function makeVoicesResponse(body = mockVoicesResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function makeSseResponse(): Response {
  return new Response('data: {"type":"audio_chunk","data":"AAAA"}\n\n', {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('createSpeechClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeSseResponse());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ─── factory options ──────────────────────────────────────────────────────

  describe('factory options', () => {
    it('accepts env: "production" and resolves the production base URL', async () => {
      const client = createSpeechClient({
        env: 'production',
        getAuthToken: async () => 'my-jwt',
      });

      await client.synthesize({ model: 'openai/gpt-4o-mini-tts', input: 'Hello', voice: 'alloy' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${DEFAULT_BASE_URLS.production}/v1/speech`);
    });

    it('throws when neither baseURL nor env is provided', () => {
      expect(() =>
        createSpeechClient({
          getAuthToken: async () => 'token',
        }),
      ).toThrow(/requires baseURL or env/);
    });
  });

  // ─── synthesize() ─────────────────────────────────────────────────────────

  describe('synthesize()', () => {
    it('sends POST to /v1/speech with Authorization and Content-Type headers', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'my-jwt',
      });

      await client.synthesize({ model: 'openai/gpt-4o-mini-tts', input: 'Hello', voice: 'alloy' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${BASE_URL}/v1/speech`);
      expect(fetchCall[1].method).toBe('POST');
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer my-jwt');
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('sends model, input, and voice in the request body', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.synthesize({
        model: 'openai/gpt-4o-mini-tts',
        input: 'Say this aloud',
        voice: 'nova',
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.model).toBe('openai/gpt-4o-mini-tts');
      expect(body.input).toBe('Say this aloud');
      expect(body.voice).toBe('nova');
    });

    it('sends optional response_format when provided', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.synthesize({
        model: 'openai/gpt-4o-mini-tts',
        input: 'Hello',
        voice: 'alloy',
        response_format: 'mp3',
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.response_format).toBe('mp3');
    });

    it('sends stream_format: "sse" when provided', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.synthesize({
        model: 'openai/gpt-4o-mini-tts',
        input: 'Hello',
        voice: 'alloy',
        stream_format: 'sse',
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.stream_format).toBe('sse');
    });

    it('returns the raw Response object for SSE consumption', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const response = await client.synthesize({
        model: 'openai/gpt-4o-mini-tts',
        input: 'Hello',
        voice: 'alloy',
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });

    it('throws AuthError on 401 with gateway error body', async () => {
      const unauthorized = new Response(
        JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
      // Auth retry fires once — both attempts must return 401 to surface the AuthError.
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(unauthorized)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
        );

      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'stale-token',
      });

      await expect(
        client.synthesize({ model: 'openai/gpt-4o-mini-tts', input: 'test', voice: 'alloy' }),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('throws AIGatewayError on 400 (e.g. invalid model or stream_format: "audio")', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid request', type: 'invalid_request_error' } }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(
        client.synthesize({ model: 'bad-model', input: 'test', voice: 'alloy' }),
      ).rejects.toBeInstanceOf(AIGatewayError);
    });

    it('throws RateLimitError on 429 (no config-level retry for POST)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
      );

      // synthesize() disables config-level retries (POST is non-idempotent and streams),
      // so a single 429 response immediately surfaces the RateLimitError.
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(
        client.synthesize({ model: 'openai/gpt-4o-mini-tts', input: 'test', voice: 'alloy' }),
      ).rejects.toBeInstanceOf(RateLimitError);
    });

    it('retries synthesize() with fresh token on stale 401', async () => {
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
        .mockResolvedValueOnce(makeSseResponse());

      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken,
      });

      await client.synthesize({ model: 'openai/gpt-4o-mini-tts', input: 'test', voice: 'alloy' });

      expect(getAuthToken).toHaveBeenNthCalledWith(1, false);
      expect(getAuthToken).toHaveBeenNthCalledWith(2, true);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    });
  });

  // ─── listVoices() ─────────────────────────────────────────────────────────

  describe('listVoices()', () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn().mockResolvedValue(makeVoicesResponse());
    });

    it('sends GET to /v1/voices with Authorization header', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'my-token',
      });

      await client.listVoices();

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${BASE_URL}/v1/voices`);
      expect(fetchCall[1].method).toBe('GET');
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer my-token');
    });

    it('appends ?model= when a model filter is provided', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.listVoices('openai');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${BASE_URL}/v1/voices?model=openai`);
    });

    it('URL-encodes the model filter', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.listVoices('elevenlabs/eleven_multilingual_v2');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain(encodeURIComponent('elevenlabs/eleven_multilingual_v2'));
    });

    it('parses and returns the VoicesResponse with data array', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const result = await client.listVoices();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('alloy');
      expect(result.data[0].provider).toBe('openai');
    });

    it('sends no query string when model is omitted', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.listVoices();

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).not.toContain('?');
    });

    it('throws AuthError on 401', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
        );

      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'stale-token',
      });

      await expect(client.listVoices()).rejects.toBeInstanceOf(AuthError);
    });
  });
});
