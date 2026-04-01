/**
 * Tests for gateway-request.ts internals exercised via the public pipeline.
 *
 * Covers paths not hit by gateway-fetch.spec.ts:
 *   - isNetworkError (TypeError "failed to fetch", Node error codes via cause chain)
 *   - executeFetch guard when globalThis.fetch is unavailable
 *   - ReadableStream body guard in executeWithAuth (no silent retry on consumed stream)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { executeRequestPipeline } from '../gateway-request';
import { resolveConfig, type GatewayProviderSettings } from '../gateway-config';
import { AuthError } from '../gateway-errors';

const BASE_URL = 'https://api.test.com';
const DEFAULT_AUTH: Pick<GatewayProviderSettings, 'getAuthToken'> = { getAuthToken: async () => null };

function makeConfig(overrides: Omit<GatewayProviderSettings, 'getAuthToken'> & Partial<Pick<GatewayProviderSettings, 'getAuthToken'>>) {
  return resolveConfig({ baseURL: BASE_URL, ...DEFAULT_AUTH, ...overrides } as GatewayProviderSettings & { baseURL: string });
}

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

    await expect(
      executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' }),
    ).rejects.toThrow('some unexpected error');
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
      await expect(
        executeRequestPipeline(config, { url: `${BASE_URL}/test`, method: 'GET' }),
      ).rejects.toThrow(/requires a global `fetch`/);
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

    const getAuthToken = vi
      .fn()
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');

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
