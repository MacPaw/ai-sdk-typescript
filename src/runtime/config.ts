/**
 * Runtime configuration shared by the HTTP client and provider integrations.
 */

import type { RequestOptions } from '../types';
import type { ApiVersion, ApiPaths } from './paths';
import { createAuthTokenCache } from './auth-token-cache';
import { buildApiPaths } from './paths';

export type Environment = 'production';

export type AuthTokenProvider = (forceRefresh?: boolean) => Promise<string | null>;

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

/** Coerces invalid `maxAttempts` (0, negative, NaN, non-finite) to the default so the retry loop always runs at least once. */
export function normalizeRetryConfig(merged: Required<RetryConfig>): Required<RetryConfig> {
  const n = Math.floor(Number(merged.maxAttempts));
  const maxAttempts = Number.isFinite(n) && n >= 1 ? n : DEFAULT_RETRY.maxAttempts;
  return { ...merged, maxAttempts };
}

/**
 * Optional logger for SDK diagnostics.
 *
 * **Security:** The SDK never passes the `Authorization` header value to
 * the logger. If you implement a custom logger, do not log raw request
 * headers — they may contain sensitive tokens in other contexts.
 */
export interface Logger {
  debug?(message: string, ...args: unknown[]): void;
  info?(message: string, ...args: unknown[]): void;
  warn?(message: string, ...args: unknown[]): void;
  error?(message: string, ...args: unknown[]): void;
}

export const NOOP_LOGGER: Logger = {};

export interface LifecycleHooks {
  /** Fired before each HTTP request (after auth + middleware). */
  onRequest?: (config: RequestConfig) => void | Promise<void>;
  /** Fired after a successful HTTP response. */
  onResponse?: (config: RequestConfig, response: Response) => void | Promise<void>;
  /** Fired when a request fails with an AIGatewayError. */
  onError?: (error: unknown, config: RequestConfig) => void | Promise<void>;
  /** Fired before a retry attempt. */
  onRetry?: (attempt: number, error: unknown, config: RequestConfig) => void | Promise<void>;
}

export interface AIGatewayClientConfig {
  /** Base URL of the AI Gateway. If omitted, env is used to select the default production URL. For staging/testing, pass the URL explicitly. */
  baseURL?: string;
  /**
   * Async function that returns the Bearer token for auth.
   * Called with `forceRefresh: true` when the SDK receives a 401 and wants a fresh token.
   * The SDK caches the token internally; return the same token if it's still valid,
   * or return a new one when forceRefresh is true.
   */
  getAuthToken: AuthTokenProvider;
  /**
   * Automatically retry once on 401 after calling getAuthToken(true).
   * Covers the common case where the token expired between issuance and use.
   * Default: true.
   */
  autoRefreshToken?: boolean;
  /**
   * Cache the auth token for this many milliseconds.
   * Set to 0 to call getAuthToken on every request. Default: 0 (no caching).
   * When the cached token results in 401, it is evicted and getAuthToken(true) is called.
   */
  tokenCacheTTL?: number;
  /** Optional custom transport. Default: fetch-based. */
  transport?: Transport;
  /** Retry policy. Set to false to disable. */
  retry?: RetryConfig | false;
  /** Middleware chain (request interceptors). */
  middleware?: Middleware[];
  /** Extra headers sent with every request. Do not set Authorization here; use getAuthToken. */
  headers?: Record<string, string>;
  /** Request timeout in ms. Default 60000. Applied to the default fetch transport. */
  timeout?: number;
  /** Environment: 'production' selects the default base URL. For non-production, use baseURL instead. */
  env?: Environment;
  /** Optional logger. No-op by default. Do not log Authorization header. */
  logger?: Logger;
  /** Lifecycle hooks for observability. */
  hooks?: LifecycleHooks;
  /** Generate X-Request-ID header for each request. Default true. */
  generateRequestId?: boolean;
  /** API version prefix (e.g. `'v1'`, `'v2'`). Default: `'v1'`. */
  apiVersion?: ApiVersion;
}

export interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: RequestInit['body'];
  signal?: AbortSignal | undefined;
  /** Transport-specific init passthrough for advanced cases such as custom fetch options. */
  transportOptions?: Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'>;
}

export interface Transport {
  /** Perform HTTP request. For streaming, return Response with body stream; runtime will consume it. */
  request(options: RequestConfig): Promise<Response>;
}

export type Middleware = (
  config: RequestConfig,
  next: (config: RequestConfig) => Promise<Response>,
) => Promise<Response>;

export interface ResolvedConfig {
  baseURL: string;
  getAuthToken: AuthTokenProvider;
  autoRefreshToken: boolean;
  tokenCacheTTL: number;
  transport?: Transport;
  retry: RetryConfig | false;
  middleware: Middleware[];
  headers?: Record<string, string>;
  timeout: number;
  env?: Environment;
  logger: Logger;
  hooks: LifecycleHooks;
  generateRequestId: boolean;
  apiPaths: ApiPaths;
}

export function resolveConfig(config: AIGatewayClientConfig & { baseURL: string }): ResolvedConfig {
  const retry = config.retry === false ? false : normalizeRetryConfig({ ...DEFAULT_RETRY, ...config.retry });
  const logger = config.logger ?? NOOP_LOGGER;
  const hooks = config.hooks ?? {};
  const middleware = [...(config.middleware ?? [])];
  const timeout = config.timeout ?? 60_000;
  const generateRequestId = config.generateRequestId ?? true;
  const autoRefreshToken = config.autoRefreshToken ?? true;
  const tokenCacheTTL = config.tokenCacheTTL ?? 0;
  const authTokenCache = createAuthTokenCache({
    loadToken: config.getAuthToken,
    ttlMs: tokenCacheTTL,
  });
  const getAuthToken: AuthTokenProvider = (forceRefresh?: boolean) => authTokenCache.get(forceRefresh);

  const apiPaths = buildApiPaths(config.apiVersion);

  return {
    baseURL: config.baseURL,
    getAuthToken,
    autoRefreshToken,
    tokenCacheTTL,
    transport: config.transport,
    retry,
    middleware,
    headers: config.headers,
    timeout,
    env: config.env,
    logger,
    hooks,
    generateRequestId,
    apiPaths,
  };
}

/** Default base URL for the production environment. For non-production, pass baseURL explicitly. */
export const DEFAULT_BASE_URLS: Record<Environment, string> = {
  production: 'https://api.macpaw.com/ai',
};

/** Re-export RequestOptions from types for convenience */
export type { RequestOptions };
