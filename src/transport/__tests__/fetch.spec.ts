import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFetchTransport } from '../../runtime/transport/fetch';

describe('createFetchTransport', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('creates a transport that delegates to fetch', async () => {
    const transport = createFetchTransport();
    const result = await transport.request({
      url: 'https://example.com/test',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(200);
  });

  it('passes signal to fetch', async () => {
    const transport = createFetchTransport();
    const controller = new AbortController();
    await transport.request({
      url: 'https://example.com/test',
      method: 'GET',
      headers: {},
      signal: controller.signal,
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].signal).toBe(controller.signal);
  });
});
