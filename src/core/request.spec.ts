import { describe, it, expect, vi } from 'vitest';
import { runRequest } from './request';
import type { ResolvedConfig, Middleware } from './config';
import { API_PATHS } from './paths';

function createMockConfig(overrides?: Partial<ResolvedConfig>): ResolvedConfig {
  return {
    baseURL: 'https://api.example.com/ai',
    getAuthToken: vi.fn().mockResolvedValue('test-token'),
    autoRefreshToken: true,
    tokenCacheTTL: 0,
    retry: false,
    middleware: [],
    timeout: 5000,
    logger: {},
    hooks: {},
    generateRequestId: true,
    apiPaths: API_PATHS,
    ...overrides,
  };
}

function createMockTransport(body: unknown = { ok: true }, status = 200) {
  return {
    request: vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  };
}

describe('runRequest', () => {
  it('builds correct URL from baseURL + path', async () => {
    const transport = createMockTransport();
    const config = createMockConfig({ transport });
    await runRequest(config, '/api/v1/chat/completions', { method: 'POST', body: '{}' });
    expect(transport.request).toHaveBeenCalledTimes(1);
    const req = transport.request.mock.calls[0][0];
    expect(req.url).toBe('https://api.example.com/ai/api/v1/chat/completions');
  });

  it('injects Authorization header from getAuthToken', async () => {
    const transport = createMockTransport();
    const config = createMockConfig({ transport });
    await runRequest(config, '/test', { method: 'GET' });
    const req = transport.request.mock.calls[0][0];
    expect(req.headers['Authorization']).toBe('Bearer test-token');
  });

  it('skips Authorization when getAuthToken returns null', async () => {
    const transport = createMockTransport();
    const config = createMockConfig({
      transport,
      getAuthToken: vi.fn().mockResolvedValue(null),
    });
    await runRequest(config, '/test', { method: 'GET' });
    const req = transport.request.mock.calls[0][0];
    expect(req.headers['Authorization']).toBeUndefined();
  });

  it('adds X-Request-ID when generateRequestId is true', async () => {
    const transport = createMockTransport();
    const config = createMockConfig({ transport, generateRequestId: true });
    await runRequest(config, '/test', { method: 'GET' });
    const req = transport.request.mock.calls[0][0];
    expect(req.headers['X-Request-ID']).toBeDefined();
    expect(req.headers['X-Request-ID']).toMatch(/^sdk-/);
  });

  it('skips X-Request-ID when generateRequestId is false', async () => {
    const transport = createMockTransport();
    const config = createMockConfig({ transport, generateRequestId: false });
    await runRequest(config, '/test', { method: 'GET' });
    const req = transport.request.mock.calls[0][0];
    expect(req.headers['X-Request-ID']).toBeUndefined();
  });

  it('merges extra headers from config and per-request options', async () => {
    const transport = createMockTransport();
    const config = createMockConfig({
      transport,
      headers: { 'X-Custom': 'from-config' },
    });
    await runRequest(config, '/test', { method: 'GET' }, { headers: { 'X-Per-Request': 'yes' } });
    const req = transport.request.mock.calls[0][0];
    expect(req.headers['X-Custom']).toBe('from-config');
    expect(req.headers['X-Per-Request']).toBe('yes');
  });

  it('throws AIGatewayError on non-OK response', async () => {
    const transport = createMockTransport(
      { statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: '2026-01-01T00:00:00Z' },
      401,
    );
    const config = createMockConfig({ transport, autoRefreshToken: false });
    await expect(runRequest(config, '/test', { method: 'GET' })).rejects.toThrow('Unauthorized');
  });

  it('calls onRequest hook before transport', async () => {
    const onRequest = vi.fn();
    const transport = createMockTransport();
    const config = createMockConfig({ transport, hooks: { onRequest } });
    await runRequest(config, '/test', { method: 'GET' });
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest.mock.calls[0][0].url).toContain('/test');
  });

  it('calls onResponse hook after successful response', async () => {
    const onResponse = vi.fn();
    const transport = createMockTransport();
    const config = createMockConfig({ transport, hooks: { onResponse } });
    await runRequest(config, '/test', { method: 'GET' });
    expect(onResponse).toHaveBeenCalledTimes(1);
  });

  it('calls onError hook on error response', async () => {
    const onError = vi.fn();
    const transport = createMockTransport(
      { statusCode: 500, message: 'Server Error', code: 'INTERNAL_SERVER_ERROR', timestamp: '2026-01-01T00:00:00Z' },
      500,
    );
    const config = createMockConfig({ transport, hooks: { onError } });
    await expect(runRequest(config, '/test', { method: 'GET' })).rejects.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does not set Content-Type for FormData bodies', async () => {
    const transport = createMockTransport();
    const config = createMockConfig({ transport });
    const formData = new FormData();
    formData.append('key', 'value');
    await runRequest(config, '/test', { method: 'POST', body: formData });
    const req = transport.request.mock.calls[0][0];
    expect(req.headers['Content-Type']).toBeUndefined();
  });

  it('uses logger for debug output', async () => {
    const debug = vi.fn();
    const transport = createMockTransport();
    const config = createMockConfig({ transport, logger: { debug } });
    await runRequest(config, '/test', { method: 'GET' });
    expect(debug).toHaveBeenCalled();
  });

  it('retries on 401 when autoRefreshToken is true', async () => {
    const transport = {
      request: vi.fn()
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: '' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ ok: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )),
    };
    const config = createMockConfig({
      transport,
      autoRefreshToken: true,
      getAuthToken: vi.fn().mockResolvedValue('fresh-token'),
    });

    const response = await runRequest(config, '/test', { method: 'GET' });
    expect(response.status).toBe(200);
    expect(transport.request).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 401 when autoRefreshToken is false', async () => {
    const transport = createMockTransport(
      { statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: '' },
      401,
    );
    const config = createMockConfig({ transport, autoRefreshToken: false });
    await expect(runRequest(config, '/test', { method: 'GET' })).rejects.toThrow('Unauthorized');
    expect(transport.request).toHaveBeenCalledTimes(1);
  });
});

describe('token refresh on 401', () => {
  it('passes forceRefresh=true on 401 retry', async () => {
    const getAuthToken = vi.fn()
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');
    const transport = {
      request: vi.fn()
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: '' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ ok: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )),
    };
    const config = createMockConfig({
      transport,
      autoRefreshToken: true,
      getAuthToken,
    });

    await runRequest(config, '/test', { method: 'GET' });

    expect(getAuthToken).toHaveBeenCalledTimes(2);
    expect(getAuthToken.mock.calls[0]).toEqual([false]);
    expect(getAuthToken.mock.calls[1]).toEqual([true]);
  });
});

describe('timeout handling', () => {
  it('rejects with timeout error when request exceeds timeout', async () => {
    const transport = {
      request: vi.fn().mockImplementation((opts: { signal: AbortSignal }) =>
        new Promise((resolve, reject) => {
          const id = setTimeout(() => resolve(new Response('ok')), 5000);
          opts.signal.addEventListener('abort', () => {
            clearTimeout(id);
            reject(opts.signal.reason);
          });
        }),
      ),
    };
    const config = createMockConfig({ transport, timeout: 50 });

    await expect(runRequest(config, '/test', { method: 'GET' })).rejects.toThrow(/timed out/i);
  });

  it('applies timeout even when user provides a signal', async () => {
    const userController = new AbortController();
    const transport = {
      request: vi.fn().mockImplementation((opts: { signal: AbortSignal }) =>
        new Promise((resolve, reject) => {
          const id = setTimeout(() => resolve(new Response('ok')), 5000);
          opts.signal.addEventListener('abort', () => {
            clearTimeout(id);
            reject(opts.signal.reason);
          });
        }),
      ),
    };
    const config = createMockConfig({ transport, timeout: 50 });

    await expect(
      runRequest(config, '/test', { method: 'GET' }, { signal: userController.signal }),
    ).rejects.toThrow(/timed out/i);
  });
});

describe('retry with timeout', () => {
  it('each retry attempt gets a full timeout window', async () => {
    const transport = {
      request: vi.fn()
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ statusCode: 503, message: 'Unavailable', code: 'SERVICE_UNAVAILABLE', timestamp: '' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ))
        .mockResolvedValueOnce(new Response(
          JSON.stringify({ ok: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )),
    };
    const config = createMockConfig({
      transport,
      retry: { maxAttempts: 2, initialDelayMs: 20 },
      timeout: 100,
    });

    const response = await runRequest(config, '/test', { method: 'GET' });
    expect(response.status).toBe(200);
    expect(transport.request).toHaveBeenCalledTimes(2);
  });
});

describe('network errors', () => {
  it('propagates TypeError for fetch failures', async () => {
    const transport = {
      request: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    };
    const config = createMockConfig({ transport });

    await expect(runRequest(config, '/test', { method: 'GET' })).rejects.toThrow('Failed to fetch');
  });
});

describe('runRequest middleware', () => {
  it('executes middleware in order', async () => {
    const order: number[] = [];
    const mw1: Middleware = async (req, next) => {
      order.push(1);
      return next(req);
    };
    const mw2: Middleware = async (req, next) => {
      order.push(2);
      return next(req);
    };
    const transport = createMockTransport();
    const config = createMockConfig({ transport, middleware: [mw1, mw2] });
    await runRequest(config, '/test', { method: 'GET' });
    expect(order).toEqual([1, 2]);
  });

  it('middleware can modify request headers', async () => {
    const mw: Middleware = async (req, next) => {
      return next({ ...req, headers: { ...req.headers, 'X-Injected': 'true' } });
    };
    const transport = createMockTransport();
    const config = createMockConfig({ transport, middleware: [mw] });
    await runRequest(config, '/test', { method: 'GET' });
    const req = transport.request.mock.calls[0][0];
    expect(req.headers['X-Injected']).toBe('true');
  });

  it('middleware can short-circuit the chain', async () => {
    const mw: Middleware = async (_req, _next) => {
      return new Response(JSON.stringify({ intercepted: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const transport = createMockTransport();
    const config = createMockConfig({ transport, middleware: [mw] });
    const res = await runRequest(config, '/test', { method: 'GET' });
    expect(transport.request).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toEqual({ intercepted: true });
  });
});
