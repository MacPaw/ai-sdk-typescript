import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import { createDecisionClient } from '../gateway-decisions';
import type { CreateDecisionRequest, DecisionRequestOptions, DecisionResponse } from '../gateway-decisions';
import { AuthError, CreditsError, ModelNotAllowedError, AIGatewayError, RateLimitError } from '../gateway-errors';
import { DEFAULT_BASE_URLS } from '../gateway-config';

const BASE_URL = 'https://api.macpaw.com/ai';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const REQUEST = {
  model: 'typesafe/jev-1.13',
  state: { tool: 'shell', command: 'rm -rf ~/Library/Caches/com.example.app' },
  questions: {
    safe_to_run: {
      type: 'noul',
      instructions: 'Is it safe to run this command without asking the user?',
      criteria: {
        true: 'The command only reads data or removes files the app can recreate.',
        false: 'The command deletes user data, changes system settings or reaches the network.',
      },
    },
    risk: {
      type: 'choice',
      criteria: {
        low: 'Read-only or easily undone.',
        medium: 'Changes files the app owns.',
        high: 'Deletes user data or changes the system.',
      },
    },
  },
} satisfies CreateDecisionRequest;

const RESPONSE = {
  id: 'gen-dec-1762772400-a1b2c3',
  model: 'typesafe/jev-1.13-20260917',
  provider: 'TypeSafe',
  answers: {
    safe_to_run: { type: 'noul', noul: 0.91, confidence: 0.82 },
    risk: {
      type: 'choice',
      choice: 'medium',
      probabilities: { low: 0.21, medium: 0.71, high: 0.08 },
      confidence: 0.64,
    },
  },
  usage: { input_tokens: 142, output_tokens: 0 },
};

function lastCall(): [string, RequestInit] {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit];
}

describe('createDecisionClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockImplementation(async () => jsonResponse(RESPONSE));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ─── factory options ──────────────────────────────────────────────────────

  describe('factory options', () => {
    it('accepts env: "production" and resolves the production base URL', async () => {
      const client = createDecisionClient({ env: 'production', getAuthToken: async () => 'my-jwt' });

      await client.create(REQUEST);

      expect(lastCall()[0]).toBe(`${DEFAULT_BASE_URLS.production}/v1/decisions`);
    });

    it('strips a trailing slash from baseURL', async () => {
      const client = createDecisionClient({ baseURL: `${BASE_URL}/`, getAuthToken: async () => 'token' });

      await client.create(REQUEST);

      expect(lastCall()[0]).toBe(`${BASE_URL}/v1/decisions`);
    });

    it('throws when neither baseURL nor env is provided', () => {
      expect(() => createDecisionClient({ getAuthToken: async () => 'token' })).toThrow(/requires baseURL or env/);
    });
  });

  // ─── create() — request ───────────────────────────────────────────────────

  describe('create() request', () => {
    it('sends POST to /v1/decisions with Authorization and JSON Content-Type headers', async () => {
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'my-jwt' });

      await client.create(REQUEST);

      const [url, init] = lastCall();
      expect(url).toBe(`${BASE_URL}/v1/decisions`);
      expect(init.method).toBe('POST');
      const headers = new Headers(init.headers);
      expect(headers.get('Authorization')).toBe('Bearer my-jwt');
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('sends the example body unchanged', async () => {
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.create(REQUEST);

      expect(JSON.parse(lastCall()[1].body as string)).toEqual(REQUEST);
    });

    it('sends text and media state, assets, a score question and unknown fields as given', async () => {
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
      const request = {
        model: 'liquid/d1',
        state: ['Rate this screen', { type: 'image_url', image_url: { url: 'asset://screenshot' } }],
        questions: {
          clarity: { type: 'score', criteria: ['unclear', 'ok', 'clear'], new_question_field: 1 },
          layout: { type: 'box' },
        },
        assets: { screenshot: { type: 'image', format: 'png', data_base64: 'iVBORw0KGgo=' } },
        session_id: 'session-1',
        user: 'user-1',
        new_gateway_field: { enabled: true },
      } satisfies CreateDecisionRequest;

      await client.create(request);

      expect(JSON.parse(lastCall()[1].body as string)).toEqual(request);
    });

    it('rejects a request that cannot be JSON-encoded before calling fetch', async () => {
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client.create({ ...REQUEST, state: { count: 10n } }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(TypeError);
      expect((err as Error).message).toBe('createDecisionClient: request cannot be JSON-encoded.');
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
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
      const controller = new AbortController();

      const pending = client.create(REQUEST, { signal: controller.signal });
      controller.abort(new Error('cancelled by user'));

      await expect(pending).rejects.toThrow('cancelled by user');
    });
  });

  // ─── create() — response ──────────────────────────────────────────────────

  describe('create() response', () => {
    it('returns the parsed answers', async () => {
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const result = await client.create(REQUEST);

      expect(result).toEqual(RESPONSE);
      expect(result.answers.safe_to_run.noul).toBe(0.91);
      expect(result.answers.risk.choice).toBe('medium');
      expect(result.usage.output_tokens).toBe(0);
    });

    it('returns a refusal answer alongside the other answers', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse({
          ...RESPONSE,
          answers: { safe_to_run: { type: 'refusal' }, risk: RESPONSE.answers.risk },
        }),
      );
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const result = await client.create(REQUEST);

      expect(result.answers.safe_to_run.type).toBe('refusal');
      expect(result.answers.risk.choice).toBe('medium');
    });

    it('throws AIGatewayError when a 200 response is not JSON', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('<html>oops</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      );
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client.create(REQUEST).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AIGatewayError);
      expect((err as AIGatewayError).message).toMatch(/Failed to parse decisions response as JSON \(HTTP 200/);
      expect((err as AIGatewayError).message).toContain('text/html');
    });
  });

  // ─── errors ───────────────────────────────────────────────────────────────

  describe('create() errors', () => {
    it('throws AuthError on 401 after one auth retry with a refreshed token', async () => {
      const unauthorized = () =>
        jsonResponse(
          {
            statusCode: 401,
            message: 'Unauthorized access',
            timestamp: '2026-11-10T12:00:00.000Z',
            code: 'UNAUTHORIZED',
            path: '/v1/decisions',
          },
          401,
        );
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(unauthorized())
        .mockResolvedValueOnce(unauthorized());
      const getAuthToken = vi.fn(async () => 'stale-token');
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken });

      await expect(client.create(REQUEST)).rejects.toBeInstanceOf(AuthError);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
      expect(getAuthToken).toHaveBeenLastCalledWith(true);
    });

    it('throws AIGatewayError with metadata.errors on 400 (no questions)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 400,
            message: 'The request syntax or parameters are invalid',
            timestamp: '2026-11-10T12:00:00.000Z',
            code: 'BAD_REQUEST',
            path: '/v1/decisions',
            errors: [
              {
                target: 'operation.validation',
                property: 'questions',
                constraints: ['isObject'],
                message: 'questions is required. questions must be a non-empty object',
              },
            ],
          },
          400,
        ),
      );
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client.create({ ...REQUEST, questions: {} }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AIGatewayError);
      expect((err as AIGatewayError).statusCode).toBe(400);
      expect((err as AIGatewayError).metadata.errors?.[0].property).toBe('questions');
    });

    it('surfaces the provider message on 400 (provider rejected the request)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 400,
            message: 'Unused asset: screenshot',
            timestamp: '2026-11-10T12:00:00.000Z',
            code: 'BAD_REQUEST',
            path: '/v1/decisions',
          },
          400,
        ),
      );
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(client.create(REQUEST)).rejects.toThrow('Unused asset: screenshot');
    });

    it('throws CreditsError on 402 (PAYMENT_REQUIRED)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 402,
            message: 'insufficient_credits',
            timestamp: '2026-11-10T12:00:00.000Z',
            code: 'PAYMENT_REQUIRED',
            path: '/v1/decisions',
          },
          402,
        ),
      );
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(client.create(REQUEST)).rejects.toBeInstanceOf(CreditsError);
    });

    it('throws ModelNotAllowedError on 403 (upstream model_access_denied envelope)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: '403',
              message: 'Not allowed to access model liquid/d1',
              param: 'model',
              type: 'model_access_denied',
            },
          },
          403,
        ),
      );
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(client.create({ ...REQUEST, model: 'liquid/d1' })).rejects.toBeInstanceOf(ModelNotAllowedError);
    });

    it('does not retry on 429 or 5xx (each request is billed)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' }, 429),
      );
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(client.create(REQUEST)).rejects.toBeInstanceOf(RateLimitError);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockClear();
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ statusCode: 503, message: 'Unavailable', code: 'SERVICE_UNAVAILABLE' }, 503),
      );

      await expect(client.create(REQUEST)).rejects.toBeInstanceOf(AIGatewayError);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });
  });

  // ─── type surface ─────────────────────────────────────────────────────────

  describe('types', () => {
    it('resolves to DecisionResponse and accepts a per-call signal', async () => {
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const result = client.create(REQUEST);

      expectTypeOf(result).resolves.toEqualTypeOf<DecisionResponse>();
      expectTypeOf<Parameters<typeof client.create>[1]>().toEqualTypeOf<DecisionRequestOptions | undefined>();
      await result;
    });

    it('requires model, state and questions, types the Gateway fields and leaves the rest open', () => {
      // @ts-expect-error — state is required
      const noState: CreateDecisionRequest = { model: 'm', questions: { q: { type: 'noul' } } };
      // @ts-expect-error — questions is required
      const noQuestions: CreateDecisionRequest = { model: 'm', state: 's' };
      const badQuestion: CreateDecisionRequest = {
        model: 'm',
        state: 's',
        // @ts-expect-error — a question needs a type
        questions: { q: { criteria: ['low', 'high'] } },
      };
      // @ts-expect-error — session_id is a string
      const badSession: CreateDecisionRequest = { model: 'm', state: 's', questions: {}, session_id: 1 };
      const open: CreateDecisionRequest = {
        model: 'any/model',
        state: 's',
        questions: { q: { type: 'new_type', extra: true } },
        new_gateway_field: true,
      };
      expect([noState, noQuestions, badQuestion, badSession, open]).toHaveLength(5);
    });
  });
});
