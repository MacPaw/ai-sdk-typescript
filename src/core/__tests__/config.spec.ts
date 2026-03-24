import { describe, it, expect } from 'vitest';
import { resolveConfig, DEFAULT_BASE_URLS, DEFAULT_RETRY } from '../config';
import type { Middleware, RequestConfig } from '../../runtime/config';

describe('resolveConfig', () => {
  const baseConfig = {
    baseURL: 'https://api.example.com/ai',
    getAuthToken: async () => 'token',
  };

  it('applies default retry config when not specified', () => {
    const resolved = resolveConfig(baseConfig);
    expect(resolved.retry).toEqual(DEFAULT_RETRY);
  });

  it('disables retry when set to false', () => {
    const resolved = resolveConfig({ ...baseConfig, retry: false });
    expect(resolved.retry).toBe(false);
  });

  it('merges custom retry config with defaults', () => {
    const resolved = resolveConfig({ ...baseConfig, retry: { maxAttempts: 5 } });
    expect(resolved.retry).toEqual({ ...DEFAULT_RETRY, maxAttempts: 5 });
  });

  it('defaults timeout to 60000', () => {
    const resolved = resolveConfig(baseConfig);
    expect(resolved.timeout).toBe(60000);
  });

  it('uses custom timeout', () => {
    const resolved = resolveConfig({ ...baseConfig, timeout: 10000 });
    expect(resolved.timeout).toBe(10000);
  });

  it('defaults generateRequestId to true', () => {
    const resolved = resolveConfig(baseConfig);
    expect(resolved.generateRequestId).toBe(true);
  });

  it('initializes empty middleware array', () => {
    const resolved = resolveConfig(baseConfig);
    expect(resolved.middleware).toEqual([]);
  });

  it('copies provided middleware', () => {
    const mw: Middleware = async (config: RequestConfig, next) => next(config);
    const resolved = resolveConfig({ ...baseConfig, middleware: [mw] });
    expect(resolved.middleware).toHaveLength(1);
    expect(resolved.middleware[0]).toBe(mw);
  });

  it('defaults hooks to empty object', () => {
    const resolved = resolveConfig(baseConfig);
    expect(resolved.hooks).toEqual({});
  });

  it('defaults autoRefreshToken to true', () => {
    const resolved = resolveConfig(baseConfig);
    expect(resolved.autoRefreshToken).toBe(true);
  });

  it('defaults tokenCacheTTL to 0', () => {
    const resolved = resolveConfig(baseConfig);
    expect(resolved.tokenCacheTTL).toBe(0);
  });

  it('caches token when tokenCacheTTL > 0', async () => {
    let callCount = 0;
    const resolved = resolveConfig({
      ...baseConfig,
      getAuthToken: async () => `token-${++callCount}`,
      tokenCacheTTL: 60_000,
    });

    const t1 = await resolved.getAuthToken();
    const t2 = await resolved.getAuthToken();
    expect(t1).toBe('token-1');
    expect(t2).toBe('token-1');
    expect(callCount).toBe(1);
  });

  it('forces fresh token on forceRefresh even when cached', async () => {
    let callCount = 0;
    const resolved = resolveConfig({
      ...baseConfig,
      getAuthToken: async () => `token-${++callCount}`,
      tokenCacheTTL: 60_000,
    });

    const t1 = await resolved.getAuthToken();
    const t2 = await resolved.getAuthToken(true);
    expect(t1).toBe('token-1');
    expect(t2).toBe('token-2');
  });

  it('deduplicates concurrent token fetches (no thundering herd)', async () => {
    let callCount = 0;
    let resolveToken: ((v: string) => void) | undefined;
    const resolved = resolveConfig({
      ...baseConfig,
      getAuthToken: async () => {
        callCount++;
        return new Promise<string>((r) => {
          resolveToken = r;
        });
      },
      tokenCacheTTL: 60_000,
    });

    const p1 = resolved.getAuthToken();
    const p2 = resolved.getAuthToken();
    const p3 = resolved.getAuthToken();
    expect(callCount).toBe(1);

    resolveToken!('shared-token');
    const [t1, t2, t3] = await Promise.all([p1, p2, p3]);
    expect(t1).toBe('shared-token');
    expect(t2).toBe('shared-token');
    expect(t3).toBe('shared-token');
    expect(callCount).toBe(1);
  });

  it('forceRefresh=true invalidates a pending non-forced refresh', async () => {
    let callCount = 0;
    const resolvers: Array<(v: string) => void> = [];
    const resolved = resolveConfig({
      ...baseConfig,
      getAuthToken: async () => {
        callCount++;
        return new Promise<string>((r) => {
          resolvers.push(r);
        });
      },
      tokenCacheTTL: 60_000,
    });

    // Start a non-forced refresh
    void resolved.getAuthToken(false);
    expect(callCount).toBe(1);

    // Force refresh while non-forced is pending — must start a NEW call
    const p2 = resolved.getAuthToken(true);
    expect(callCount).toBe(2);

    // Resolve both
    resolvers[0]('stale-token');
    resolvers[1]('fresh-token');
    expect(await p2).toBe('fresh-token');
  });

  it('clears pending promise on token fetch error so next call retries', async () => {
    let callCount = 0;
    const resolved = resolveConfig({
      ...baseConfig,
      getAuthToken: async () => {
        callCount++;
        if (callCount === 1) throw new Error('auth failed');
        return 'recovered-token';
      },
      tokenCacheTTL: 60_000,
    });

    await expect(resolved.getAuthToken()).rejects.toThrow('auth failed');
    const token = await resolved.getAuthToken();
    expect(token).toBe('recovered-token');
    expect(callCount).toBe(2);
  });

  it('defaults apiPaths to v1', () => {
    const resolved = resolveConfig(baseConfig);
    expect(resolved.apiPaths.ChatCompletions).toBe('/api/v1/chat/completions');
  });

  it('uses custom apiVersion', () => {
    const resolved = resolveConfig({ ...baseConfig, apiVersion: 'v2' });
    expect(resolved.apiPaths.ChatCompletions).toBe('/api/v2/chat/completions');
    expect(resolved.apiPaths.Embeddings).toBe('/api/v2/embeddings');
    expect(resolved.apiPaths.Responses).toBe('/api/v2/responses');
  });
});

describe('DEFAULT_BASE_URLS', () => {
  it('has production URL', () => {
    expect(DEFAULT_BASE_URLS.production).toBe('https://api.macpaw.com/ai');
  });

  it('does not expose non-production URLs', () => {
    const keys = Object.keys(DEFAULT_BASE_URLS);
    expect(keys).toEqual(['production']);
  });
});
