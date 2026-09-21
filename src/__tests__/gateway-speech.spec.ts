import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpeechClient } from '../gateway-speech';
import { AuthError, RateLimitError, CreditsError, ModelNotAllowedError, AIGatewayError } from '../gateway-errors';
import { DEFAULT_BASE_URLS } from '../gateway-config';

const BASE_URL = 'https://api.macpaw.com/ai';

function makeSseResponse(): Response {
  return new Response('event: speech.audio.delta\ndata: {"type":"speech.audio.delta","audio":"AAAA"}\n\n', {
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

  // ─── createSpeechClient() — factory options ───────────────────────────────

  describe('factory options', () => {
    it('accepts env: "production" and resolves the production base URL', async () => {
      const client = createSpeechClient({
        env: 'production',
        getAuthToken: async () => 'my-jwt',
      });

      await client.create({ model: 'openai/gpt-4o-mini-tts', input: 'Hello', voice: 'alloy' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${DEFAULT_BASE_URLS.production}/v1/audio/speech`);
    });

    it('throws when neither baseURL nor env is provided', () => {
      expect(() =>
        createSpeechClient({
          getAuthToken: async () => 'token',
        }),
      ).toThrow(/requires baseURL or env/);
    });
  });

  // ─── create() — request shape ──────────────────────────────────────────────

  describe('create()', () => {
    it('sends POST to /v1/audio/speech with Authorization and Content-Type headers', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'my-jwt',
      });

      await client.create({ model: 'openai/gpt-4o-mini-tts', input: 'Hello', voice: 'alloy' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${BASE_URL}/v1/audio/speech`);
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

      await client.create({
        model: 'elevenlabs/eleven_multilingual_v2',
        input: 'The first move is what sets everything in motion.',
        voice: 'JBFqnCBsd6RMkjVDRZzb',
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.model).toBe('elevenlabs/eleven_multilingual_v2');
      expect(body.input).toBe('The first move is what sets everything in motion.');
      expect(body.voice).toBe('JBFqnCBsd6RMkjVDRZzb');
    });

    it('sends optional fields when provided (response_format, raw_provider_response)', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.create({
        model: 'elevenlabs/eleven_flash_v2_5',
        input: 'The first move is what sets everything in motion.',
        voice: 'JBFqnCBsd6RMkjVDRZzb',
        response_format: 'mp3_44100_128',
        raw_provider_response: true,
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.response_format).toBe('mp3_44100_128');
      expect(body.raw_provider_response).toBe(true);
    });

    it('accepts a plain OpenAI codec name for response_format', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.create({
        model: 'openai/gpt-4o-mini-tts',
        input: 'Today is a wonderful day to build something people love!',
        voice: 'alloy',
        response_format: 'mp3',
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.response_format).toBe('mp3');
    });

    it('passes through model-specific parameters not in the typed interface', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.create({
        model: 'openai/gpt-4o-mini-tts',
        input: 'Hello',
        voice: 'alloy',
        speed: 1.25,
        instructions: 'Speak cheerfully',
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.speed).toBe(1.25);
      expect(body.instructions).toBe('Speak cheerfully');
    });

    it('returns the raw Response object for stream consumption', async () => {
      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const response = await client.create({ model: 'openai/gpt-4o-mini-tts', input: 'Hello', voice: 'alloy' });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
    });

    it('returns the raw Response unmodified when raw_provider_response is true', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('{"audio_base64":"AAAA","alignment":{}}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const response = await client.create({
        model: 'elevenlabs/eleven_flash_v2_5',
        input: 'Hello',
        voice: 'JBFqnCBsd6RMkjVDRZzb',
        raw_provider_response: true,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    // ─── errors ───────────────────────────────────────────────────────────────

    it('throws AuthError on 401', async () => {
      const unauthorized = new Response(
        JSON.stringify({ statusCode: 401, message: 'Unauthorized access', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
      // Auth retry fires once — both attempts must return 401 to surface the AuthError.
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(
        new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized access', code: 'UNAUTHORIZED' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'stale-token',
      });

      await expect(
        client.create({ model: 'openai/gpt-4o-mini-tts', input: 'Hello', voice: 'alloy' }),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('throws AIGatewayError on 400 (gateway validation error)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 400,
            code: 'BAD_REQUEST',
            message: 'The request syntax or parameters are invalid',
            path: '/v1/audio/speech',
            timestamp: '2024-01-01T00:00:00.000Z',
            errors: [
              {
                property: 'input',
                constraints: ['maxLength'],
                message: 'input must not be longer than 5000 characters',
              },
            ],
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      );

      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(
        client.create({ model: 'openai/gpt-4o-mini-tts', input: 'x'.repeat(6000), voice: 'alloy' }),
      ).rejects.toBeInstanceOf(AIGatewayError);
    });

    it('throws CreditsError on 402 (insufficient credits)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 402,
            code: 'PAYMENT_REQUIRED',
            message: 'Payment required',
            path: '/v1/audio/speech',
            timestamp: '2026-02-10T12:02:51.288Z',
          }),
          { status: 402, headers: { 'content-type': 'application/json' } },
        ),
      );

      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(
        client.create({ model: 'openai/gpt-4o-mini-tts', input: 'Hello', voice: 'alloy' }),
      ).rejects.toBeInstanceOf(CreditsError);
    });

    it('throws ModelNotAllowedError on 403 (upstream team_model_access_denied envelope)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: '403',
              message: 'team not allowed to access model. Tried to access openai/gpt-6-astrak',
              param: 'model',
              type: 'team_model_access_denied',
            },
          }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        ),
      );

      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(
        client.create({ model: 'openai/gpt-6-astrak', input: 'Hello', voice: 'alloy' }),
      ).rejects.toBeInstanceOf(ModelNotAllowedError);
    });

    it('throws RateLimitError on 429 without retrying (create() disables config-level retries)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createSpeechClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(
        client.create({ model: 'openai/gpt-4o-mini-tts', input: 'Hello', voice: 'alloy' }),
      ).rejects.toBeInstanceOf(RateLimitError);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });
  });
});
