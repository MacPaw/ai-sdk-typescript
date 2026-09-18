import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCreditBalanceClient } from '../gateway-balance';
import type { CreditBalancesResponse } from '../gateway-balance';
import { AIGatewayError, AuthError } from '../gateway-errors';
import { DEFAULT_BASE_URLS } from '../gateway-config';

const BASE_URL = 'https://api.macpaw.com/ai';
const BALANCES_URL = 'https://api.macpaw.com/entitlement/v1/ai/credits/balances';

const mockBalancesResponse = {
  data: {
    balances: [
      {
        id: '01970f12-3c4d-7a8b-b123-456789abcde0',
        type: 'subscription' as const,
        currentValue: { amount: '500000', currency: 'MACPAW_CREDITS' as const },
        initialValue: { amount: '500000', currency: 'MACPAW_CREDITS' as const },
        expiresAt: 1736899200,
        metadata: null,
      },
      {
        id: '01970f12-8a9b-7c0d-d234-56789abcdef1',
        type: 'subscription' as const,
        currentValue: { amount: '500000', currency: 'MACPAW_CREDITS' as const },
        initialValue: { amount: '500000', currency: 'MACPAW_CREDITS' as const },
        expiresAt: 1736899200,
        metadata: { membership: { price: { name: 'Annual' } } },
      },
    ],
    totalAvailable: { amount: '1000000', currency: 'MACPAW_CREDITS' as const },
    totalInitialAmount: { amount: '1500000', currency: 'MACPAW_CREDITS' as const },
  },
};

function makeBalancesResponse(body: unknown = mockBalancesResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createCreditBalanceClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeBalancesResponse());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ─── factory options ───────────────────────────────────────────────────────

  describe('factory options', () => {
    it('accepts env: "production" and resolves the production base URL', async () => {
      const client = createCreditBalanceClient({
        env: 'production',
        getAuthToken: async () => 'my-jwt',
      });

      await client.getBalances();

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const expectedOrigin = new URL(DEFAULT_BASE_URLS.production).origin;
      expect(fetchCall[0]).toBe(`${expectedOrigin}/entitlement/v1/ai/credits/balances`);
    });

    it('throws when neither baseURL nor env is provided', () => {
      expect(() =>
        createCreditBalanceClient({
          getAuthToken: async () => 'token',
        }),
      ).toThrow(/requires baseURL or env/);
    });

    it('derives the entitlement URL from the baseURL origin', async () => {
      const client = createCreditBalanceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await client.getBalances();

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(BALANCES_URL);
    });
  });

  // ─── getBalances() ─────────────────────────────────────────────────────────

  describe('getBalances()', () => {
    it('sends GET to the entitlement balances URL with Authorization header', async () => {
      const client = createCreditBalanceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'my-jwt',
      });

      await client.getBalances();

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(BALANCES_URL);
      expect(fetchCall[1].method).toBe('GET');
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer my-jwt');
    });

    it('parses and returns the full CreditBalancesResponse', async () => {
      const client = createCreditBalanceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const result = await client.getBalances();

      expect(result.data.balances).toHaveLength(2);
      expect(result.data.totalAvailable.amount).toBe('1000000');
      expect(result.data.totalAvailable.currency).toBe('MACPAW_CREDITS');
      expect(result.data.totalInitialAmount.amount).toBe('1500000');
    });

    it('returns balances with null metadata', async () => {
      const client = createCreditBalanceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const result = await client.getBalances();
      const first = result.data.balances[0];

      expect(first.id).toBe('01970f12-3c4d-7a8b-b123-456789abcde0');
      expect(first.type).toBe('subscription');
      expect(first.metadata).toBeNull();
    });

    it('returns balances with membership metadata', async () => {
      const client = createCreditBalanceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const result = await client.getBalances();
      const second = result.data.balances[1];

      expect(second.metadata?.membership?.price?.name).toBe('Annual');
    });

    it('returns a balance with referenceId in metadata (migrated legacy row)', async () => {
      const migratedResponse: CreditBalancesResponse = {
        data: {
          balances: [
            {
              id: '01970f12-3c4d-7a8b-b123-456789abcde0',
              type: 'subscription',
              currentValue: { amount: '500000', currency: 'MACPAW_CREDITS' },
              initialValue: { amount: '500000', currency: 'MACPAW_CREDITS' },
              expiresAt: 1736899200,
              metadata: { membership: { referenceId: '8fcf5165-8a10-44ce-be25-21867da3b41b' } },
            },
          ],
          totalAvailable: { amount: '500000', currency: 'MACPAW_CREDITS' },
          totalInitialAmount: { amount: '500000', currency: 'MACPAW_CREDITS' },
        },
      };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeBalancesResponse(migratedResponse));

      const client = createCreditBalanceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      const result = await client.getBalances();
      expect(result.data.balances[0].metadata?.membership?.referenceId).toBe(
        '8fcf5165-8a10-44ce-be25-21867da3b41b',
      );
    });

    it('throws AuthError on 401', async () => {
      const unauthorized = new Response(
        JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(unauthorized)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
        );

      const client = createCreditBalanceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'stale-token',
      });

      await expect(client.getBalances()).rejects.toBeInstanceOf(AuthError);
    });

    it('throws AIGatewayError when response JSON is unparseable', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('not json', { status: 200, headers: { 'content-type': 'application/json' } }),
      );

      const client = createCreditBalanceClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
      });

      await expect(client.getBalances()).rejects.toBeInstanceOf(AIGatewayError);
    });

    it('retries on auth refresh when first token is stale', async () => {
      let callCount = 0;
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
              status: 401,
              headers: { 'content-type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(makeBalancesResponse());
      });

      const client = createCreditBalanceClient({
        baseURL: BASE_URL,
        getAuthToken: async (forceRefresh) => (forceRefresh ? 'fresh-token' : 'stale-token'),
      });

      const result = await client.getBalances();
      expect(callCount).toBe(2);
      expect(result.data.totalAvailable.amount).toBe('1000000');
    });
  });
});
