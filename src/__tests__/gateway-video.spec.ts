import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVideoClient } from '../gateway-video';
import { AIGatewayError } from '../gateway-errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVideoJobResponse(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'video-123',
    status: 'pending',
    model: 'kling-1.6-pro',
    prompt: 'A cat on a skateboard',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFetchMock(status: number, body: unknown, contentType = 'application/json') {
  return vi.fn().mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': contentType },
    }),
  );
}

// ─── createVideoClient factory ────────────────────────────────────────────────

describe('createVideoClient', () => {
  it('requires baseURL or env — throws when neither is provided', () => {
    expect(() =>
      createVideoClient({
        getAuthToken: async () => 'tok',
      }),
    ).toThrow(/requires baseURL or env/i);
  });

  it('creates a client object with createVideo, getVideo, and getVideoContent methods', () => {
    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'tok',
    });
    expect(typeof client.createVideo).toBe('function');
    expect(typeof client.getVideo).toBe('function');
    expect(typeof client.getVideoContent).toBe('function');
  });
});

// ─── createVideo ──────────────────────────────────────────────────────────────

describe('createVideo', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('happy path: POSTs to /v1/videos and returns a VideoJob', async () => {
    const jobBody = makeVideoJobResponse();
    const customFetch = makeFetchMock(200, jobBody);

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'my-token',
      fetch: customFetch,
    });

    const job = await client.createVideo({ model: 'kling-1.6-pro', prompt: 'A cat on a skateboard' });

    expect(customFetch).toHaveBeenCalledTimes(1);
    const [url, init] = customFetch.mock.calls[0];
    expect(url).toBe('https://api.macpaw.com/ai/v1/videos');
    expect(init.method).toBe('POST');
    expect(job.id).toBe('video-123');
    expect(job.status).toBe('pending');
  });

  it('serialises the request body as JSON and sets Content-Type', async () => {
    const customFetch = makeFetchMock(200, makeVideoJobResponse());

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
      fetch: customFetch,
    });

    await client.createVideo({ model: 'model-x', prompt: 'A sunrise', duration: 5 });

    const [, init] = customFetch.mock.calls[0];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody).toMatchObject({ model: 'model-x', prompt: 'A sunrise', duration: 5 });
    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('error path: throws AIGatewayError on 4xx responses', async () => {
    const customFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 422, message: 'Invalid model', code: 'VALIDATION' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'tok',
      fetch: customFetch,
      retry: false,
    });

    await expect(client.createVideo({ model: 'bad-model', prompt: 'test' })).rejects.toBeInstanceOf(AIGatewayError);
  });
});

// ─── getVideo ─────────────────────────────────────────────────────────────────

describe('getVideo', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('happy path: GETs /v1/videos/:videoId and returns a VideoJob with VideoStatus', async () => {
    const jobBody = makeVideoJobResponse({ status: 'processing' });
    const customFetch = makeFetchMock(200, jobBody);

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'tok',
      fetch: customFetch,
    });

    const job = await client.getVideo('video-123');

    const [url, init] = customFetch.mock.calls[0];
    expect(url).toBe('https://api.macpaw.com/ai/v1/videos/video-123');
    expect(init.method).toBe('GET');
    expect(job.status).toBe('processing');
  });

  it('encodes the videoId in the path to prevent injection', async () => {
    const customFetch = makeFetchMock(200, makeVideoJobResponse({ id: 'a/b' }));

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
      fetch: customFetch,
    });

    await client.getVideo('a/b');

    const [url] = customFetch.mock.calls[0];
    expect(url).toBe('https://api.macpaw.com/ai/v1/videos/a%2Fb');
  });

  it('error path: throws AIGatewayError on 404 responses', async () => {
    const customFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 404, message: 'Video not found', code: 'NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'tok',
      fetch: customFetch,
      retry: false,
    });

    await expect(client.getVideo('missing-id')).rejects.toBeInstanceOf(AIGatewayError);
  });
});

// ─── getVideoContent ──────────────────────────────────────────────────────────

describe('getVideoContent', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('happy path: GETs /v1/videos/:videoId/content and returns ArrayBuffer with contentType', async () => {
    const videoBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
    const customFetch = vi.fn().mockResolvedValue(
      new Response(videoBytes, {
        status: 200,
        headers: { 'Content-Type': 'video/mp4' },
      }),
    );

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'tok',
      fetch: customFetch,
    });

    const { data, contentType } = await client.getVideoContent('video-123');

    const [url] = customFetch.mock.calls[0];
    expect(url).toBe('https://api.macpaw.com/ai/v1/videos/video-123/content');
    expect(data).toBeInstanceOf(ArrayBuffer);
    expect(data.byteLength).toBe(4);
    expect(contentType).toBe('video/mp4');
  });

  it('defaults contentType to "video/mp4" when Content-Type header is absent', async () => {
    const videoBytes = new Uint8Array([0xff, 0xfe]).buffer;
    const customFetch = vi.fn().mockResolvedValue(new Response(videoBytes, { status: 200 }));

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
      fetch: customFetch,
    });

    const { contentType } = await client.getVideoContent('video-456');
    expect(contentType).toBe('video/mp4');
  });

  it('encodes the videoId in the content path', async () => {
    const videoBytes = new Uint8Array([]).buffer;
    const customFetch = vi
      .fn()
      .mockResolvedValue(new Response(videoBytes, { status: 200, headers: { 'Content-Type': 'video/mp4' } }));

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
      fetch: customFetch,
    });

    await client.getVideoContent('a/b');
    const [url] = customFetch.mock.calls[0];
    expect(url).toBe('https://api.macpaw.com/ai/v1/videos/a%2Fb/content');
  });
});

// ─── Bearer auth propagation ───────────────────────────────────────────────────

describe('Bearer auth injection', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('injects Authorization: Bearer header from getAuthToken into video requests', async () => {
    const customFetch = makeFetchMock(200, makeVideoJobResponse());

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => 'my-jwt',
      fetch: customFetch,
    });

    await client.createVideo({ model: 'kling-1.6-pro', prompt: 'test' });

    const [, init] = customFetch.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer my-jwt');
  });

  it('calls getAuthToken on every request (no caching)', async () => {
    const getAuthToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('token-1')
      .mockResolvedValueOnce('token-2');

    const makeJobResponse = () =>
      new Response(JSON.stringify(makeVideoJobResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const customFetch = vi.fn().mockResolvedValueOnce(makeJobResponse()).mockResolvedValueOnce(makeJobResponse());

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken,
      fetch: customFetch,
    });

    await client.getVideo('vid-1');
    await client.getVideo('vid-2');

    expect(getAuthToken).toHaveBeenCalledTimes(2);
    const secondHeaders = new Headers(customFetch.mock.calls[1][1].headers);
    expect(secondHeaders.get('Authorization')).toBe('Bearer token-2');
  });

  it('omits Authorization header when getAuthToken returns null', async () => {
    const customFetch = makeFetchMock(200, makeVideoJobResponse());

    const client = createVideoClient({
      baseURL: 'https://api.macpaw.com/ai',
      getAuthToken: async () => null,
      fetch: customFetch,
    });

    await client.getVideo('vid-1');

    const [, init] = customFetch.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.has('Authorization')).toBe(false);
  });
});
