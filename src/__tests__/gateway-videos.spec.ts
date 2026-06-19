import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVideoClient } from '../gateway-videos';
import { AIGatewayError, AuthError, RateLimitError } from '../gateway-errors';

const BASE_URL = 'https://api.macpaw.com/ai';
const VIDEO_ID = 'vid_abc123';

const mockVideoJob = {
  id: VIDEO_ID,
  object: 'video.generation.job',
  status: 'queued' as const,
  model: 'veo-2',
  prompt: 'A sunset over the ocean',
  created_at: 1700000000,
};

function makeVideoJobResponse(job = mockVideoJob): Response {
  return new Response(JSON.stringify(job), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createVideoClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeVideoJobResponse());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ─── create() ─────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('sends POST to /v1/videos with Authorization and Content-Type headers', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'my-jwt',
      });

      await client.create({ model: 'veo-2', prompt: 'A sunset over the ocean' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${BASE_URL}/v1/videos`);
      expect(fetchCall[1].method).toBe('POST');
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer my-jwt');
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('sends model and prompt in the request body', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.create({ model: 'veo-2', prompt: 'A sunrise over the mountains' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.model).toBe('veo-2');
      expect(body.prompt).toBe('A sunrise over the mountains');
    });

    it('sends optional fields when provided (seconds, size, input_reference)', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.create({
        model: 'veo-2',
        prompt: 'A beach at night',
        seconds: '5',
        size: '1280x720',
        input_reference: { image_url: 'https://example.com/image.jpg' },
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.seconds).toBe('5');
      expect(body.size).toBe('1280x720');
      expect(body.input_reference).toEqual({ image_url: 'https://example.com/image.jpg' });
    });

    it('parses and returns the VideoJob from the response', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const job = await client.create({ model: 'veo-2', prompt: 'A sunset over the ocean' });

      expect(job.id).toBe(VIDEO_ID);
      expect(job.object).toBe('video.generation.job');
      expect(job.status).toBe('queued');
      expect(job.model).toBe('veo-2');
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

      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'stale-token',
      });

      await expect(client.create({ model: 'veo-2', prompt: 'test' })).rejects.toBeInstanceOf(AuthError);
    });

    it('throws AIGatewayError on 400 with OpenAI error body', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid model', type: 'invalid_request_error' } }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(client.create({ model: 'bad-model', prompt: 'test' })).rejects.toBeInstanceOf(AIGatewayError);
    });

    it('throws RateLimitError on 429', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
        retry: { maxAttempts: 1 }, // exhaust retries immediately
      });

      await expect(client.create({ model: 'veo-2', prompt: 'test' })).rejects.toBeInstanceOf(RateLimitError);
    });
  });

  // ─── get() ────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('sends GET to /v1/videos/{videoId} with Authorization header', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'my-token',
      });

      await client.get(VIDEO_ID);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${BASE_URL}/v1/videos/${VIDEO_ID}`);
      expect(fetchCall[1].method).toBe('GET');
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer my-token');
    });

    it('parses and returns the VideoJob from the response', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const job = await client.get(VIDEO_ID);

      expect(job.id).toBe(VIDEO_ID);
      expect(job.status).toBe('queued');
    });

    it('throws AIGatewayError on 404 with OpenAI NOT_FOUND body', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Video not found', type: null, code: 'NOT_FOUND' } }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(client.get(VIDEO_ID)).rejects.toBeInstanceOf(AIGatewayError);
    });

    it('returns a VideoJob with status "failed" and numeric error.code (Google Veo scenario)', async () => {
      const failedJob = {
        id: VIDEO_ID,
        object: 'video.generation.job',
        status: 'failed',
        model: 'veo-2',
        prompt: 'test',
        error: { code: 3, message: 'INVALID_ARGUMENT' },
      };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify(failedJob), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const job = await client.get(VIDEO_ID);

      expect(job.status).toBe('failed');
      expect(job.error?.code).toBe(3);
      expect(typeof job.error?.code).toBe('number');
    });
  });

  // ─── getContent() ─────────────────────────────────────────────────────────

  describe('getContent()', () => {
    it('sends GET to /v1/videos/{videoId}/content with no query params', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.getContent(VIDEO_ID);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${BASE_URL}/v1/videos/${VIDEO_ID}/content`);
      expect(fetchCall[1].method).toBe('GET');
      expect(fetchCall[0]).not.toContain('?');
    });

    it('returns the raw Response object for binary consumption', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(new Uint8Array([0xff, 0xd8, 0xff]).buffer, {
          status: 200,
          headers: { 'content-type': 'video/mp4' },
        }),
      );

      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const response = await client.getContent(VIDEO_ID);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });

    it('appends ?variant=thumbnail when variant is thumbnail', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.getContent(VIDEO_ID, 'thumbnail');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('?variant=thumbnail');
      expect(fetchCall[0]).toBe(`${BASE_URL}/v1/videos/${VIDEO_ID}/content?variant=thumbnail`);
    });

    it('appends ?variant=video when variant is video', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.getContent(VIDEO_ID, 'video');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('?variant=video');
    });

    it('throws AIGatewayError on 404 (content not yet available)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Content not yet available', type: null } }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(client.getContent(VIDEO_ID)).rejects.toBeInstanceOf(AIGatewayError);
    });

    it('throws AIGatewayError on 410 (asset expired)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Asset expired', type: null } }), {
          status: 410,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(client.getContent(VIDEO_ID)).rejects.toBeInstanceOf(AIGatewayError);
    });
  });

  // ─── Auth / pipeline integration ──────────────────────────────────────────

  describe('auth / pipeline integration', () => {
    it('injects Bearer token via create()', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'bearer-for-create',
      });

      await client.create({ model: 'veo-2', prompt: 'test' });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer bearer-for-create');
    });

    it('injects Bearer token via get()', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'bearer-for-get',
      });

      await client.get(VIDEO_ID);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer bearer-for-get');
    });

    it('injects Bearer token via getContent()', async () => {
      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'bearer-for-content',
      });

      await client.getContent(VIDEO_ID);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer bearer-for-content');
    });

    it('retries create() with fresh token on stale 401', async () => {
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
        .mockResolvedValueOnce(makeVideoJobResponse());

      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken,
      });

      await client.create({ model: 'veo-2', prompt: 'test' });

      expect(getAuthToken).toHaveBeenNthCalledWith(1, false);
      expect(getAuthToken).toHaveBeenNthCalledWith(2, true);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    });

    it('retries get() with fresh token on stale 401', async () => {
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
        .mockResolvedValueOnce(makeVideoJobResponse());

      const client = createVideoClient({
        baseURL: BASE_URL,
        getAuthToken,
      });

      await client.get(VIDEO_ID);

      expect(getAuthToken).toHaveBeenNthCalledWith(1, false);
      expect(getAuthToken).toHaveBeenNthCalledWith(2, true);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    });
  });
});
