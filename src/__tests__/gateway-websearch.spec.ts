import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import { createWebSearchClient, DEFAULT_WEBSEARCH_TIMEOUT_MS } from '../gateway-websearch';
import type { WebSearchRequest, WebSearchRequestOptions, WebSearchResponse } from '../gateway-websearch';
import { AuthError, CreditsError, ModelNotAllowedError, AIGatewayError, RateLimitError } from '../gateway-errors';
import { DEFAULT_BASE_URLS } from '../gateway-config';

const BASE_URL = 'https://api.macpaw.com/ai';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const EXA_RESPONSE = {
  requestId: 'b5947044c4b78efa9552a7c89b306d95',
  results: [
    {
      id: 'https://developer.apple.com/documentation/servicemanagement',
      url: 'https://developer.apple.com/documentation/servicemanagement',
      title: 'Service Management | Apple Developer Documentation',
      publishedDate: '2026-03-14T00:00:00.000Z',
      author: 'Apple Inc.',
      favicon: 'https://developer.apple.com/favicon.ico',
      highlights: ['SMAppService lets an app register a launch agent that runs when the user logs in.'],
      highlightScores: [0.8213],
    },
  ],
  searchTime: 184.2,
};

const BRAVE_RESPONSE = {
  type: 'search',
  query: { original: 'launch agents on macOS site:developer.apple.com', country: 'us', more_results_available: true },
  mixed: { type: 'mixed', main: [{ type: 'web', index: 0, all: false }], top: [], side: [] },
  web: {
    type: 'search',
    family_friendly: true,
    results: [
      {
        title: 'Service Management | Apple Developer Documentation',
        url: 'https://developer.apple.com/documentation/servicemanagement',
        description: 'Register <strong>launch agents</strong> and login items with SMAppService.',
        page_age: '2026-03-14T00:00:00',
        age: 'March 14, 2026',
        language: 'en',
        family_friendly: true,
        type: 'search_result',
        meta_url: { scheme: 'https', hostname: 'developer.apple.com', favicon: 'https://imgs.search.brave.com/a.png' },
        extra_snippets: ['SMAppService lets an app register a launch agent that runs when the user logs in.'],
      },
    ],
  },
};

function lastCall(): [string, RequestInit] {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit];
}

describe('createWebSearchClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockImplementation(async () => jsonResponse(EXA_RESPONSE));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ─── factory options ──────────────────────────────────────────────────────

  describe('factory options', () => {
    it('accepts env: "production" and resolves the production base URL', async () => {
      const client = createWebSearchClient({ env: 'production', getAuthToken: async () => 'my-jwt' });

      await client.search({ model: 'exa/exa', query: 'launch agents on macOS' });

      expect(lastCall()[0]).toBe(`${DEFAULT_BASE_URLS.production}/v1/websearch`);
    });

    it('strips a trailing slash from baseURL', async () => {
      const client = createWebSearchClient({ baseURL: `${BASE_URL}/`, getAuthToken: async () => 'token' });

      await client.search({ model: 'exa/exa', query: 'q' });

      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/websearch`);
    });

    it('defaults the timeout to DEFAULT_WEBSEARCH_TIMEOUT_MS and honors an explicit timeout', async () => {
      expect(DEFAULT_WEBSEARCH_TIMEOUT_MS).toBe(120_000);
      vi.useFakeTimers();
      try {
        const hang = (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
          });

        globalThis.fetch = vi.fn().mockImplementation(hang);
        const byDefault = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
        let settled = false;
        const pending = byDefault.search({ model: 'exa/exa', query: 'q' }).finally(() => {
          settled = true;
        });
        pending.catch(() => {});
        await vi.advanceTimersByTimeAsync(60_000);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(DEFAULT_WEBSEARCH_TIMEOUT_MS - 60_000);
        await expect(pending).rejects.toThrow(/timed out after 120000ms/);

        const custom = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token', timeout: 1_000 });
        const quick = custom.search({ model: 'exa/exa', query: 'q' });
        quick.catch(() => {});
        await vi.advanceTimersByTimeAsync(1_000);
        await expect(quick).rejects.toThrow(/timed out after 1000ms/);
      } finally {
        vi.useRealTimers();
      }
    });

    it('throws when neither baseURL nor env is provided', () => {
      expect(() => createWebSearchClient({ getAuthToken: async () => 'token' })).toThrow(/requires baseURL or env/);
    });
  });

  // ─── search() — request shape ─────────────────────────────────────────────

  describe('search() request', () => {
    it('sends POST to /v1/websearch with Authorization and JSON Content-Type headers', async () => {
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'my-jwt' });

      await client.search({ model: 'exa/exa', query: 'launch agents on macOS' });

      const [url, init] = lastCall();
      expect(url).toBe(`${BASE_URL}/v1/websearch`);
      expect(init.method).toBe('POST');
      const headers = new Headers(init.headers);
      expect(headers.get('Authorization')).toBe('Bearer my-jwt');
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('sends the Exa example body unchanged', async () => {
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
      const request = {
        model: 'exa/exa',
        query: 'launch agents on macOS',
        limit: 5,
        include_domains: ['developer.apple.com'],
        country: 'UA',
        location: { latitude: 50.45, longitude: 30.52 },
        provider_options: {
          type: 'auto',
          category: 'news',
          startPublishedDate: '2026-01-01T00:00:00.000Z',
          contents: { highlights: true, text: { maxCharacters: 1000 } },
        },
      } satisfies WebSearchRequest;

      await client.search(request);

      expect(JSON.parse(lastCall()[1].body as string)).toEqual(request);
    });

    it('sends the Brave example body unchanged, including header-mapped x-loc-* options', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => jsonResponse(BRAVE_RESPONSE));
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
      const request = {
        model: 'brave/brave',
        query: 'launch agents on macOS',
        limit: 10,
        include_domains: ['developer.apple.com'],
        exclude_domains: ['reddit.com'],
        country: 'US',
        location: { latitude: 37.7749, longitude: -122.4194 },
        provider_options: {
          freshness: 'pw',
          search_lang: 'en',
          safesearch: 'moderate',
          result_filter: ['web', 'news'],
          extra_snippets: true,
          'x-loc-city': 'San Francisco',
          'x-loc-timezone': 'America/Los_Angeles',
        },
      } satisfies WebSearchRequest;

      await client.search(request);

      expect(JSON.parse(lastCall()[1].body as string)).toEqual(request);
    });

    it('forwards any provider_options as sent', async () => {
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.search({ model: 'exa/exa', query: 'q', provider_options: { newFlag: 1, nested: { a: [1] } } });

      expect(JSON.parse(lastCall()[1].body as string).provider_options).toEqual({ newFlag: 1, nested: { a: [1] } });
    });

    it('forwards a new provider and unknown top-level fields without SDK changes', async () => {
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.search({
        model: 'tavily/search',
        query: 'q',
        search_depth: 'advanced',
        provider_options: { include_answer: true },
      });

      expect(JSON.parse(lastCall()[1].body as string)).toEqual({
        model: 'tavily/search',
        query: 'q',
        search_depth: 'advanced',
        provider_options: { include_answer: true },
      });
    });

    it('omits undefined fields from the body', async () => {
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.search({ model: 'exa/exa', query: 'q', limit: undefined, provider_options: null });

      expect(JSON.parse(lastCall()[1].body as string)).toEqual({
        model: 'exa/exa',
        query: 'q',
        provider_options: null,
      });
    });

    it('rejects a request that cannot be JSON-encoded before calling fetch', async () => {
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client
        .search({ model: 'exa/exa', query: 'q', provider_options: { seed: 10n } })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(TypeError);
      expect((err as Error).message).toBe('createWebSearchClient: request cannot be JSON-encoded.');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('passes the per-call AbortSignal to fetch and rejects when it is aborted', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            if (init.signal?.aborted) return reject(init.signal.reason);
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
          }),
      );
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
      const controller = new AbortController();

      const pending = client.search({ model: 'exa/exa', query: 'q' }, { signal: controller.signal });
      controller.abort(new Error('cancelled by user'));

      await expect(pending).rejects.toThrow('cancelled by user');
    });
  });

  // ─── search() — response handling ─────────────────────────────────────────

  describe('search() response', () => {
    it('returns the parsed Exa response', async () => {
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const result = await client.search<typeof EXA_RESPONSE>({
        model: 'exa/exa',
        query: 'launch agents on macOS',
        limit: 1,
      });

      expect(result).toEqual(EXA_RESPONSE);
      expect(result.results[0].url).toBe('https://developer.apple.com/documentation/servicemanagement');
    });

    it('returns an empty Exa result list as-is', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse({ requestId: '9c1d7e2a4b5f6a7b8c9d0e1f2a3b4c5d', results: [] }),
      );
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const result = await client.search({ model: 'exa/exa', query: 'nothing matches this' });

      expect(result).toEqual({ requestId: '9c1d7e2a4b5f6a7b8c9d0e1f2a3b4c5d', results: [] });
    });

    it('returns the parsed Brave response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse(BRAVE_RESPONSE));
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const result = await client.search<typeof BRAVE_RESPONSE>({
        model: 'brave/brave',
        query: 'launch agents on macOS',
        limit: 1,
      });

      expect(result).toEqual(BRAVE_RESPONSE);
      expect(result.web.results[0].title).toBe('Service Management | Apple Developer Documentation');
    });

    it('throws AIGatewayError when a 200 response is not JSON', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('<html>oops</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      );
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client.search({ model: 'exa/exa', query: 'q' }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AIGatewayError);
      expect((err as AIGatewayError).message).toMatch(/Failed to parse web search response as JSON \(HTTP 200/);
      expect((err as AIGatewayError).message).toContain('text/html');
    });
  });

  // ─── errors ───────────────────────────────────────────────────────────────

  describe('search() errors', () => {
    it('throws AuthError on 401 after one auth retry with a refreshed token', async () => {
      const unauthorized = () =>
        jsonResponse(
          {
            statusCode: 401,
            message: 'Unauthorized access',
            timestamp: '2026-10-27T12:00:00.000Z',
            code: 'UNAUTHORIZED',
            path: '/v1/websearch',
          },
          401,
        );
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(unauthorized());
      const getAuthToken = vi.fn(async () => 'stale-token');
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken });

      await expect(client.search({ model: 'exa/exa', query: 'q' })).rejects.toBeInstanceOf(AuthError);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
      expect(getAuthToken).toHaveBeenLastCalledWith(true);
    });

    it('throws AIGatewayError with metadata.errors on 400 (Brave operators off)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 400,
            message: 'The request syntax or parameters are invalid',
            timestamp: '2026-10-27T12:00:00.000Z',
            code: 'BAD_REQUEST',
            path: '/v1/websearch',
            errors: [
              {
                target: 'operation.validation',
                property: 'provider_options.operators',
                constraints: ['invalidParameterCombination'],
                message: 'provider_options.operators must not be false with include_domains or exclude_domains',
              },
            ],
          },
          400,
        ),
      );
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client
        .search({
          model: 'brave/brave',
          query: 'q',
          include_domains: ['developer.apple.com'],
          provider_options: { operators: false },
        })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AIGatewayError);
      expect((err as AIGatewayError).statusCode).toBe(400);
      expect((err as AIGatewayError).metadata.errors?.[0].property).toBe('provider_options.operators');
    });

    it('surfaces the provider message on 400 (provider rejected the parameters)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 400,
            message: "Invalid request body: category 'people' does not support excludeDomains",
            timestamp: '2026-10-27T12:00:00.000Z',
            code: 'BAD_REQUEST',
            path: '/v1/websearch',
          },
          400,
        ),
      );
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(
        client.search({
          model: 'exa/exa',
          query: 'q',
          exclude_domains: ['x.com'],
          provider_options: { category: 'people' },
        }),
      ).rejects.toThrow("category 'people' does not support excludeDomains");
    });

    it('throws CreditsError on 402 (PAYMENT_REQUIRED)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 402,
            message: 'insufficient_credits',
            timestamp: '2026-10-27T12:00:00.000Z',
            code: 'PAYMENT_REQUIRED',
            path: '/v1/websearch',
            errors: [
              {
                target: 'operation.payment',
                constraints: ['error.payment.insufficient_credits'],
                message: 'insufficient_credits',
                metadata: { paymentUrl: 'https://account.setapp.com/get-credits' },
              },
            ],
          },
          402,
        ),
      );
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(client.search({ model: 'exa/exa', query: 'q' })).rejects.toBeInstanceOf(CreditsError);
    });

    it('throws ModelNotAllowedError on 403 (upstream model_access_denied envelope)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: '403',
              message: 'Not allowed to access model exa/exa-pro',
              param: 'model',
              type: 'model_access_denied',
            },
          },
          403,
        ),
      );
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(client.search({ model: 'exa/exa-pro', query: 'q' })).rejects.toBeInstanceOf(ModelNotAllowedError);
    });

    it('does not retry on 429 or 5xx (each search is billed)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' }, 429),
      );
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(client.search({ model: 'exa/exa', query: 'q' })).rejects.toBeInstanceOf(RateLimitError);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockClear();
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ statusCode: 503, message: 'Unavailable', code: 'SERVICE_UNAVAILABLE' }, 503),
      );

      await expect(client.search({ model: 'exa/exa', query: 'q' })).rejects.toBeInstanceOf(AIGatewayError);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });
  });

  // ─── type surface ─────────────────────────────────────────────────────────

  describe('types', () => {
    it('returns WebSearchResponse by default and the caller-named type with T', async () => {
      const client = createWebSearchClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const byDefault = client.search({ model: 'exa/exa', query: 'q' });
      const named = client.search<{ results: unknown[] }>({ model: 'brave/brave', query: 'q' });

      expectTypeOf(byDefault).resolves.toEqualTypeOf<WebSearchResponse>();
      expectTypeOf(named).resolves.toEqualTypeOf<{ results: unknown[] }>();

      await Promise.all([byDefault, named]);
    });

    it('requires model and query, types the Gateway fields and leaves provider fields open', () => {
      // @ts-expect-error — query is required
      const noQuery: WebSearchRequest = { model: 'exa/exa' };
      // @ts-expect-error — model is required
      const noModel: WebSearchRequest = { query: 'q' };
      // @ts-expect-error — limit is a number
      const badLimit: WebSearchRequest = { model: 'exa/exa', query: 'q', limit: '5' };
      const open: WebSearchRequest = {
        model: 'any/model',
        query: 'q',
        new_gateway_field: true,
        provider_options: { anything: ['goes'] },
      };
      expect([noQuery, noModel, badLimit, open]).toHaveLength(4);
    });

    it('accepts a per-call signal', () => {
      expectTypeOf<Parameters<ReturnType<typeof createWebSearchClient>['search']>[1]>().toEqualTypeOf<
        WebSearchRequestOptions | undefined
      >();
    });
  });
});
