/**
 * Configuration types and resolver for the AI Gateway SDK.
 *
 * GatewayProviderSettings is the public API — 8 fields.
 * ResolvedConfig is the internal resolved form used by the request pipeline.
 */

/**
 * Supported gateway environments.
 * Only 'production' is exposed — non-production setups use a direct `baseURL`
 * instead, keeping env-specific URL management out of this library.
 */
export type Environment = 'production';

export interface RetryConfig {
  /** Max number of attempts (including first). Default 3. */
  maxAttempts?: number;
  /** Initial delay in ms. Default 1000. */
  initialDelayMs?: number;
  /** Max delay in ms. Default 30000. */
  maxDelayMs?: number;
  /** Retry only on these status codes (and network errors). Default: 429, 5xx. */
  retryableStatuses?: number[];
}

export const DEFAULT_RETRY: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/** Coerces invalid `maxAttempts` (0, negative, NaN) to the default. */
export function normalizeRetryConfig(merged: Required<RetryConfig>): Required<RetryConfig> {
  const n = Math.floor(Number(merged.maxAttempts));
  const maxAttempts = Number.isFinite(n) && n >= 1 ? n : DEFAULT_RETRY.maxAttempts;
  return { ...merged, maxAttempts };
}

export interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: RequestInit['body'];
  signal?: AbortSignal | undefined;
}

export type Middleware = (
  config: RequestConfig,
  next: (config: RequestConfig) => Promise<Response>,
) => Promise<Response>;

/**
 * Configuration for AI Gateway providers and NestJS module.
 *
 * Exactly 8 fields — covers auth, routing, request behaviour and middleware.
 */
export interface GatewayProviderSettings {
  /** Gateway base URL. Required if env is not set. */
  baseURL?: string;
  /** 'production' uses the default MacPaw Gateway URL. */
  env?: Environment;
  /**
   * Returns Bearer token for auth.
   * Called with `forceRefresh=true` after 401 — provide a fresh token.
   */
  getAuthToken: (forceRefresh?: boolean) => Promise<string | null>;
  /** Extra headers sent with every request. Do not set Authorization here. */
  headers?: Record<string, string>;
  /** Retry policy. Set to false to disable. */
  retry?: RetryConfig | false;
  /** Request timeout in ms. Default: 60000. */
  timeout?: number;
  /** Request interceptors. Run in order before each request. */
  middleware?: Middleware[];
  /**
   * Custom fetch implementation.
   * Use for testing or low-level request customization.
   */
  fetch?: typeof fetch;
}

/** Internal resolved form — used only by the request pipeline. */
export interface ResolvedConfig {
  baseURL: string;
  getAuthToken: (forceRefresh?: boolean) => Promise<string | null>;
  /** Already normalized — all fields present, maxAttempts ≥ 1. */
  retry: Required<RetryConfig> | false;
  middleware: Middleware[];
  headers?: Record<string, string>;
  timeout: number;
  fetchImpl?: typeof fetch;
}

export function resolveConfig(config: GatewayProviderSettings & { baseURL: string }): ResolvedConfig {
  return {
    baseURL: config.baseURL,
    getAuthToken: config.getAuthToken,
    retry: config.retry === false ? false : normalizeRetryConfig({ ...DEFAULT_RETRY, ...config.retry }),
    middleware: [...(config.middleware ?? [])],
    headers: config.headers,
    timeout: config.timeout ?? 60_000,
    fetchImpl: config.fetch,
  };
}

/** Default base URL for the production environment. */
export const DEFAULT_BASE_URLS: Record<Environment, string> = {
  production: 'https://api.macpaw.com/ai',
};

export function resolveGatewayBaseURL(
  baseURL: string | undefined,
  env: Environment | undefined,
  consumerName: string,
): string {
  const resolved = baseURL ?? (env ? DEFAULT_BASE_URLS[env] : undefined);
  if (!resolved) {
    throw new Error(
      `${consumerName} requires baseURL or env (production). For non-production environments, pass baseURL directly.`,
    );
  }
  return resolved;
}
