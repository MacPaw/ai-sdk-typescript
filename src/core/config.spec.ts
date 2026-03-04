import { describe, it, expect } from 'vitest';
import { resolveConfig, DEFAULT_BASE_URLS, DEFAULT_RETRY } from './config';

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
    const mw = async (c: any, n: any) => n(c);
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
