import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import {
  createDecisionClient,
  DEFAULT_DECISIONS_TIMEOUT_MS,
  isChoiceAnswer,
  isNoulAnswer,
  isRefusalAnswer,
  isScoreAnswer,
} from '../gateway-decisions';
import type {
  CreateDecisionRequest,
  DecisionAnswer,
  DecisionChoiceAnswer,
  DecisionNoulAnswer,
  DecisionRequestOptions,
  DecisionResponse,
} from '../gateway-decisions';
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

    it.each([undefined, null, [], 'text'])('rejects a request that is %j before calling fetch', async (request) => {
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client.create(request as unknown as CreateDecisionRequest).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(TypeError);
      expect((err as Error).message).toBe('createDecisionClient: request must be an object.');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty string state', { state: '' }, '`state` must not be empty'],
      ['a null state', { state: null }, '`state` must not be empty'],
      ['a missing state', { state: undefined }, '`state` must not be empty'],
      ['empty questions', { questions: {} }, '`questions` must have at least one question'],
      ['missing questions', { questions: undefined }, '`questions` must have at least one question'],
      ['array questions', { questions: [] }, '`questions` must have at least one question'],
    ])('rejects %s before calling fetch', async (_label, patch, message) => {
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client
        .create({ ...REQUEST, ...patch } as unknown as CreateDecisionRequest)
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(TypeError);
      expect((err as Error).message).toContain(message);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('defaults the timeout to DEFAULT_DECISIONS_TIMEOUT_MS and honors an explicit timeout', async () => {
      expect(DEFAULT_DECISIONS_TIMEOUT_MS).toBe(120_000);
      vi.useFakeTimers();
      try {
        const hang = (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
          });
        globalThis.fetch = vi.fn().mockImplementation(hang);

        const byDefault = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
        let settled = false;
        const pending = byDefault.create(REQUEST).finally(() => {
          settled = true;
        });
        pending.catch(() => {});
        await vi.advanceTimersByTimeAsync(60_000);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(DEFAULT_DECISIONS_TIMEOUT_MS - 60_000);
        await expect(pending).rejects.toThrow(/timed out after 120000ms/);

        const custom = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token', timeout: 1_000 });
        const quick = custom.create(REQUEST);
        quick.catch(() => {});
        await vi.advanceTimersByTimeAsync(1_000);
        await expect(quick).rejects.toThrow(/timed out after 1000ms/);
      } finally {
        vi.useRealTimers();
      }
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
      expect(result.answers.safe_to_run?.noul).toBe(0.91);
      expect(result.answers.risk?.choice).toBe('medium');
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

      expect(isRefusalAnswer(result.answers.safe_to_run)).toBe(true);
      expect(result.answers.risk?.choice).toBe('medium');
    });

    it.each([
      ['null', null],
      ['an array', []],
      ['an object without answers', { id: 'x', model: 'm', usage: {} }],
      ['answers that are not an object', { ...RESPONSE, answers: [] }],
    ])('throws AIGatewayError when the 200 body is %s', async (_label, body) => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse(body));
      const client = createDecisionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client.create(REQUEST).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AIGatewayError);
      expect((err as AIGatewayError).message).toMatch(/Unexpected decisions response/);
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

      const err = await client.create(REQUEST).catch((e: unknown) => e);

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

  // ─── answer guards ────────────────────────────────────────────────────────

  describe('answer guards', () => {
    it('match by type and require the type value', () => {
      expect(isNoulAnswer({ type: 'noul', noul: 0.91 })).toBe(true);
      expect(isNoulAnswer({ type: 'noul' })).toBe(false);
      expect(isNoulAnswer({ type: 'noul', noul: null } as unknown as DecisionAnswer)).toBe(false);
      expect(isRefusalAnswer({ type: 'noul' })).toBe(false);
      expect(isChoiceAnswer({ type: 'choice', choice: 'medium' })).toBe(true);
      expect(isChoiceAnswer({ type: 'noul', noul: 1 })).toBe(false);
      expect(isScoreAnswer({ type: 'score', score: 2.3, legend: { '0': 'low' } })).toBe(true);
      expect(isScoreAnswer({ type: 'score', score: '2' } as unknown as DecisionAnswer)).toBe(false);
      expect(isRefusalAnswer({ type: 'refusal' })).toBe(true);
      expect(isRefusalAnswer({ type: 'choice', choice: 'x' })).toBe(false);
    });

    it('return false for a missing answer', () => {
      expect(isNoulAnswer(undefined)).toBe(false);
      expect(isChoiceAnswer(undefined)).toBe(false);
      expect(isScoreAnswer(undefined)).toBe(false);
      expect(isRefusalAnswer(undefined)).toBe(false);
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

    it('types answers as possibly missing and narrows them with the guards', () => {
      expectTypeOf<DecisionResponse['answers'][string]>().toEqualTypeOf<DecisionAnswer | undefined>();

      const answer = { type: 'noul', noul: 0.4 } as DecisionAnswer | undefined;
      if (isNoulAnswer(answer)) expectTypeOf(answer).toEqualTypeOf<DecisionNoulAnswer>();
      if (isChoiceAnswer(answer)) expectTypeOf(answer.choice).toBeString();
      expectTypeOf<DecisionChoiceAnswer['choice']>().toBeString();
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
        questions: {
          q: { type: 'new_type', extra: true },
          rank: { type: 'rank', criteria: 'Order by relevance' },
          threshold: { type: 'threshold', criteria: 0.5 },
        },
        assets: {
          remote: { type: 'image_url', url: 'https://cdn.example.com/screen.png' },
          clip: { type: 'audio', format: 'mp3', data_base64: 'SUQz' },
        },
        new_gateway_field: true,
      };
      expect([noState, noQuestions, badQuestion, badSession, open]).toHaveLength(5);
    });
  });
});
