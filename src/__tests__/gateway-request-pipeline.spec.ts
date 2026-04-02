/**
 * Tests for gateway-request.ts internals exercised via the public pipeline.
 *
 * Covers paths not hit by gateway-fetch.spec.ts:
 *   - isNetworkError (TypeError "failed to fetch", Node error codes via cause chain)
 *   - executeFetch guard when globalThis.fetch is unavailable
 *   - ReadableStream body guard in executeWithAuth (no silent retry on consumed stream)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { GATEWAY_PLACEHOLDER_API_KEY } from '../gateway-auth-token';
import { executeRequestPipeline, redactSensitiveHeaders } from '../gateway-request';
import { resolveConfig, type GatewayProviderSettings } from '../gateway-config';
import { AuthError } from '../gateway-errors';

const BASE_URL = 'https://api.test.com';
const DEFAULT_AUTH: Pick<GatewayProviderSettings, 'getAuthToken'> = { getAuthToken: async () => null };

function makeConfig(
  overrides: Omit<GatewayProviderSettings, 'getAuthToken'> & Partial<Pick<GatewayProviderSettings, 'getAuthToken'>>,
) {
  return resolveConfig({ baseURL: BASE_URL, ...DEFAULT_AUTH, ...overrides } as GatewayProviderSettings & {
    baseURL: string;
  });
}

// ─── Authorization: avoid duplicate header fields (comma-merged on some servers) ─

describe('executeRequestPipeline — single Authorization field', () => {
  it('removes all Authorization casings then sets one Bearer from getAuthToken', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const config = makeConfig({
      fetch: mockFetch,
      getAuthToken: async () => 'user-jwt',
      retry: false,
    });

    await executeRequestPipeline(config, {
      url: `${BASE_URL}/test`,
      method: 'GET',
      headers: {
        authorization: `Bearer ${GATEWAY_PLACEHOLDER_API_KEY}`,
        Authorization: `Bearer ${GATEWAY_PLACEHOLDER_API_KEY}`,
      },
    });

    const passedHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    const authKeys = Object.keys(passedHeaders).filter((k) => k.toLowerCase() === 'authorization');
    expect(authKeys).toHaveLength(1);
    expect(passedHeaders.Authorization).toBe('Bearer user-jwt');
  });
});

// ─── isNetworkError ───────────────────────────────────────────────────────────

describe('isNetworkError — retry behaviour', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries on TypeError with "failed to fetch" message', async () => {
    let attempt = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      if (++attempt === 1) throw new TypeError('Failed to fetch');
      return Promise.resolve(new Response('ok', { status: 200 }));
    });

    const config = makeConfig({
      fetch: mockFetch,
      retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1 },
    });

    const response = await executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on TypeError with "load failed" message (Safari/WebKit)', async () => {
    let attempt = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      if (++attempt === 1) throw new TypeError('Load failed');
      return Promise.resolve(new Response('ok', { status: 200 }));
    });

    const config = makeConfig({
      fetch: mockFetch,
      retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1 },
    });

    const response = await executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on Node error code ECONNRESET', async () => {
    let attempt = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      if (++attempt === 1) {
        const err = Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' });
        throw err;
      }
      return Promise.resolve(new Response('ok', { status: 200 }));
    });

    const config = makeConfig({
      fetch: mockFetch,
      retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1 },
    });

    const response = await executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on ECONNREFUSED', async () => {
    let attempt = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      if (++attempt === 1) throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      return Promise.resolve(new Response('ok', { status: 200 }));
    });

    const config = makeConfig({
      fetch: mockFetch,
      retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1 },
    });

    const response = await executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' });
    expect(response.status).toBe(200);
  });

  it('retries when error code is in nested cause chain (depth ≤ 5)', async () => {
    let attempt = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      if (++attempt === 1) {
        const inner = Object.assign(new Error('inner'), { code: 'ENOTFOUND' });
        const outer = new Error('Outer wrapper');
        (outer as NodeJS.ErrnoException).cause = inner;
        throw outer;
      }
      return Promise.resolve(new Response('ok', { status: 200 }));
    });

    const config = makeConfig({
      fetch: mockFetch,
      retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1 },
    });

    const response = await executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on a generic non-network Error', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      throw new Error('some unexpected error');
    });

    const config = makeConfig({
      fetch: mockFetch,
      retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 1 },
    });

    await expect(executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' })).rejects.toThrow(
      'some unexpected error',
    );
    // Should not retry — non-network, non-status error
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─── fetch unavailable guard ──────────────────────────────────────────────────

describe('executeFetch — fetch unavailable', () => {
  it('throws a descriptive error when globalThis.fetch is undefined and no custom fetch given', async () => {
    const originalFetch = globalThis.fetch;
    // Simulate an environment without fetch (e.g. old Node / JSDOM without polyfill)
    Object.defineProperty(globalThis, 'fetch', { value: undefined, writable: true, configurable: true });

    try {
      const config = makeConfig({ retry: false });
      await expect(executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' })).rejects.toThrow(
        /requires a global `fetch`/,
      );
    } finally {
      Object.defineProperty(globalThis, 'fetch', { value: originalFetch, writable: true, configurable: true });
    }
  });

  it('uses the custom fetchImpl instead of globalThis.fetch when provided', async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', { value: undefined, writable: true, configurable: true });

    try {
      const customFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const config = makeConfig({ fetch: customFetch, retry: false });

      const response = await executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' });
      expect(response.status).toBe(200);
      expect(customFetch).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(globalThis, 'fetch', { value: originalFetch, writable: true, configurable: true });
    }
  });
});

// ─── anySignal polyfill — AbortSignal.any unavailable ────────────────────────

describe('anySignal polyfill (AbortSignal.any unavailable)', () => {
  it('timeout still fires when AbortSignal.any is not available (Node 18/19 path)', async () => {
    // AbortSignal.any was added in Node 20.3. On Node 18/19 the polyfill runs.
    const saved = (AbortSignal as unknown as { any?: unknown }).any;
    delete (AbortSignal as unknown as { any?: unknown }).any;

    try {
      const mockFetch = vi.fn().mockImplementation(
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

      const config = makeConfig({ fetch: mockFetch, timeout: 50, retry: false });

      await expect(executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' })).rejects.toThrow(
        /timed out/i,
      );
    } finally {
      if (saved !== undefined) {
        (AbortSignal as unknown as { any?: unknown }).any = saved;
      }
    }
  });

  it('user abort signal respected through polyfill when AbortSignal.any absent', async () => {
    const saved = (AbortSignal as unknown as { any?: unknown }).any;
    delete (AbortSignal as unknown as { any?: unknown }).any;

    try {
      const controller = new AbortController();
      const mockFetch = vi.fn().mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise((resolve, reject) => {
            const signal = init?.signal;
            const id = setTimeout(() => resolve(new Response('ok', { status: 200 })), 5000);
            signal?.addEventListener('abort', () => {
              clearTimeout(id);
              reject(signal.reason ?? new Error('aborted'));
            });
          }),
      );

      const config = makeConfig({ fetch: mockFetch, timeout: 5000, retry: false });

      const promise = executeRequestPipeline(config, {
        url: `${BASE_URL}/test`,
        method: 'GET',
        signal: controller.signal,
      });

      setTimeout(() => controller.abort(new Error('user cancelled')), 30);

      await expect(promise).rejects.toThrow('user cancelled');
    } finally {
      if (saved !== undefined) {
        (AbortSignal as unknown as { any?: unknown }).any = saved;
      }
    }
  });
});

// ─── redactSensitiveHeaders ───────────────────────────────────────────────────

describe('redactSensitiveHeaders', () => {
  it('replaces Authorization value with [REDACTED]', () => {
    const result = redactSensitiveHeaders({ Authorization: 'Bearer secret', 'Content-Type': 'application/json' });
    expect(result.Authorization).toBe('[REDACTED]');
    expect(result['Content-Type']).toBe('application/json');
  });

  it('redacts authorization regardless of casing', () => {
    const result = redactSensitiveHeaders({ authorization: 'Bearer token', 'X-Request-ID': 'req-1' });
    expect(result.authorization).toBe('[REDACTED]');
    expect(result['X-Request-ID']).toBe('req-1');
  });

  it('returns empty object for empty input', () => {
    expect(redactSensitiveHeaders({})).toEqual({});
  });

  it('does not mutate the input object', () => {
    const input = { Authorization: 'secret', Accept: '*/*' };
    redactSensitiveHeaders(input);
    expect(input.Authorization).toBe('secret');
  });
});

// ─── ReadableStream body — auth retry guard ───────────────────────────────────

describe('executeWithAuth — ReadableStream body guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does NOT retry auth on ReadableStream body — throws AuthError immediately', async () => {
    const authErrorBody = JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' });
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(authErrorBody, {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const getAuthToken = vi.fn().mockResolvedValue('token');
    const config = makeConfig({ fetch: mockFetch, getAuthToken, retry: false });

    const streamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"model":"gpt-4"}'));
        controller.close();
      },
    });

    await expect(
      executeRequestPipeline(config, { url: `${BASE_URL}/chat`, method: 'POST', body: streamBody }),
    ).rejects.toBeInstanceOf(AuthError);

    // Fetch called only once — no retry attempted
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // getAuthToken called once (no second call for forceRefresh)
    expect(getAuthToken).toHaveBeenCalledTimes(1);
  });

  it('DOES retry on 401 when body is a JSON string (normal path unaffected)', async () => {
    const authErrorBody = JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' });
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(authErrorBody, { status: 401, headers: { 'Content-Type': 'application/json' } }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const getAuthToken = vi.fn().mockResolvedValueOnce('stale-token').mockResolvedValueOnce('fresh-token');

    const config = makeConfig({ fetch: mockFetch, getAuthToken, retry: false });

    const response = await executeRequestPipeline(config, {
      url: `${BASE_URL}/chat`,
      method: 'POST',
      body: JSON.stringify({ model: 'gpt-4' }),
    });

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(getAuthToken).toHaveBeenNthCalledWith(2, true);
  });
});
