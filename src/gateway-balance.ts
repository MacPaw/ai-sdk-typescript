/**
 * Credit balance client for the AI Gateway SDK.
 *
 * Wraps the Gateway entitlement endpoint:
 *   GET  /entitlement/v1/ai/credits/balances  — list all active credit balances
 *
 * The entitlement path is derived from the configured baseURL's origin, so
 * `https://api.macpaw.com/ai` resolves to
 * `https://api.macpaw.com/entitlement/v1/ai/credits/balances`.
 */

import type { GatewayProviderSettings } from './gateway-config';
import { resolveConfig, resolveGatewayBaseURL } from './gateway-config';
import { AIGatewayError, ErrorCode } from './gateway-errors';
import { executeRequestPipeline } from './gateway-request';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditAmount {
  /** Numeric amount as a string (e.g. `"500000"`). */
  amount: string;
  currency: 'MACPAW_CREDITS';
}

export interface CreditBalanceMembershipMetadata {
  /** Price snapshot attached at purchase time. */
  price?: { name: string };
  /** Only present on balances migrated from a legacy membership record. */
  referenceId?: string;
}

export interface CreditBalanceMetadata {
  membership?: CreditBalanceMembershipMetadata;
}

export type CreditBalanceType = 'subscription';

export interface CreditBalance {
  /** Unique balance identifier. */
  id: string;
  type: CreditBalanceType;
  /** Remaining credits on this balance. */
  currentValue: CreditAmount;
  /** Credits at the time the balance was issued. */
  initialValue: CreditAmount;
  /** Unix timestamp when the balance expires. Absent means no expiry. */
  expiresAt?: number | null;
  /** Provider-specific metadata, or `null` when none. */
  metadata: CreditBalanceMetadata | null;
}

export interface CreditBalanceSummary {
  /** Active balances ordered by FEFO (First Expiring, First Out). */
  balances: CreditBalance[];
  /** Sum of all active balance `currentValue` amounts. */
  totalAvailable: CreditAmount;
  /** Sum of all active balance `initialValue` amounts. */
  totalInitialAmount: CreditAmount;
}

export interface CreditBalancesResponse {
  data: CreditBalanceSummary;
}

/**
 * Options for `createCreditBalanceClient`.
 * Accepts either `baseURL` or `env: 'production'` — the same convention used by
 * `createGatewayProvider` and `createVideoClient`.
 */
export type GatewayCreditBalanceClientOptions = GatewayProviderSettings;

/** Public interface returned by `createCreditBalanceClient`. */
export interface CreditBalanceClient {
  /**
   * Fetch all active AI credit balances for the authenticated user.
   * Active balances have `currentValue.amount > 0` and either no expiry or
   * `expiresAt > now`. Results are ordered FEFO (First Expiring, First Out).
   */
  getBalances(): Promise<CreditBalancesResponse>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a `CreditBalanceClient` that talks to the AI Gateway entitlement endpoint.
 *
 * @example
 * ```ts
 * const balance = createCreditBalanceClient({
 *   baseURL: 'https://api.macpaw.com/ai',
 *   getAuthToken: () => Promise.resolve(myJwt),
 * });
 *
 * const { data } = await balance.getBalances();
 * console.log(data.totalAvailable.amount); // "1000000"
 * ```
 */
export function createCreditBalanceClient(options: GatewayCreditBalanceClientOptions): CreditBalanceClient {
  const resolvedBaseURL = resolveGatewayBaseURL(options.baseURL, options.env, 'createCreditBalanceClient');
  const { origin } = new URL(resolvedBaseURL);
  const balancesURL = `${origin}/entitlement/v1/ai/credits/balances`;
  const resolvedConfig = resolveConfig({ ...options, baseURL: resolvedBaseURL });

  const pipelineOptions = {
    includeAuth: true,
    normalizeErrors: true,
    allowAuthRetry: true,
  };

  return {
    async getBalances(): Promise<CreditBalancesResponse> {
      const response = await executeRequestPipeline(
        resolvedConfig,
        { url: balancesURL, method: 'GET' },
        pipelineOptions,
      );
      try {
        return (await response.json()) as CreditBalancesResponse;
      } catch (err) {
        throw new AIGatewayError(
          'Failed to parse credit balances response as JSON',
          ErrorCode.InternalServerError,
          response.status,
          {},
          { cause: err },
        );
      }
    },
  };
}
