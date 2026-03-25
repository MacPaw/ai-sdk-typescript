/**
 * Vercel AI SDK-compatible provider for AI Gateway.
 *
 * Creates a strongly typed OpenAI-compatible provider backed by the gateway,
 * making it easy to switch existing `ai` apps between direct OpenAI and
 * gateway traffic without rewriting the rest of the app.
 */

import { createOpenAI as builtinCreateOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider, OpenAIProviderSettings } from '@ai-sdk/openai';
import { createAIGatewayFetch } from './create-fetch';
import type { Environment, LifecycleHooks, Logger, Middleware, RetryConfig, Transport } from '../runtime/config';
import { DEFAULT_BASE_URLS } from '../runtime/config';
import type { ApiVersion } from '../runtime/paths';
import { DEFAULT_API_VERSION } from '../runtime/paths';

export interface AIGatewayProviderOptions extends Omit<OpenAIProviderSettings, 'apiKey' | 'baseURL' | 'fetch'> {
  /**
   * Optional override for the OpenAI provider factory.
   * Uses `createOpenAI` from `@ai-sdk/openai` by default.
   */
  createOpenAI?: typeof builtinCreateOpenAI;
  /** Base URL of the AI Gateway (HTTP API root). Required if env is not set. */
  baseURL?: string;
  /** Environment: 'production' selects the default base URL. For non-production, use baseURL instead. */
  env?: Environment;
  /** Async function that returns the Bearer token. Supports refresh-aware providers. */
  getAuthToken: (forceRefresh?: boolean) => Promise<string | null>;
  /** Extra headers for every request. */
  headers?: Record<string, string>;
  /** API version prefix (e.g. `'v1'`, `'v2'`). Default: `'v1'`. */
  apiVersion?: ApiVersion;
  /** Automatically retry once on 401 after forcing token refresh. Default: true. */
  autoRefreshToken?: boolean;
  /** Cache the auth token for this many milliseconds. Default: 0. */
  tokenCacheTTL?: number;
  /** Retry policy shared with the low-level client. Default: the SDK retry policy. */
  retry?: RetryConfig | false;
  /** Middleware chain shared with the low-level client. */
  middleware?: Middleware[];
  /** Request timeout in ms. Default: 60000. */
  timeout?: number;
  /** Optional logger used by the shared request pipeline. */
  logger?: Logger;
  /** Optional lifecycle hooks used by the shared request pipeline. */
  hooks?: LifecycleHooks;
  /** Optional custom transport shared with the low-level client. */
  transport?: Transport;
  /** Generate `X-Request-ID` for provider fetch calls. Default: true. */
  generateRequestId?: boolean;
  /** Normalize gateway error responses into `AIGatewayError`. Default: true. */
  normalizeErrors?: boolean;
}

function resolveGatewayBaseURL(baseURL?: string, env?: Environment): string {
  const resolved = baseURL ?? (env ? DEFAULT_BASE_URLS[env] : undefined);
  if (!resolved) {
    throw new Error(
      'AIGatewayProvider requires baseURL or env (production). For non-production environments, pass baseURL directly.',
    );
  }
  return resolved;
}

/**
 * Creates a Vercel AI SDK-compatible provider backed by AI Gateway.
 *
 * The returned value is a fully typed `OpenAIProvider`, so existing apps can
 * keep using their `ai-sdk` helpers and model-selection patterns.
 *
 * For a `customProvider` with gateway fallback and model aliases, use `createAIGatewayCustomProvider`.
 * To toggle gateway vs direct OpenAI from a build/env flag (e.g. marketplace build), use `createAIGatewayDualProvider`.
 */
export function createAIGatewayProvider(options: AIGatewayProviderOptions): OpenAIProvider {
  const baseURL = resolveGatewayBaseURL(options.baseURL, options.env);
  const customFetch = createAIGatewayFetch({
    baseURL,
    getAuthToken: options.getAuthToken,
    headers: options.headers,
    autoRefreshToken: options.autoRefreshToken,
    tokenCacheTTL: options.tokenCacheTTL,
    retry: options.retry,
    middleware: options.middleware,
    timeout: options.timeout,
    logger: options.logger,
    hooks: options.hooks,
    transport: options.transport,
    generateRequestId: options.generateRequestId,
    normalizeErrors: options.normalizeErrors,
  });

  const createOpenAI = options.createOpenAI ?? builtinCreateOpenAI;

  return createOpenAI({
    name: options.name,
    organization: options.organization,
    project: options.project,
    baseURL: `${baseURL.replace(/\/$/, '')}/api/${options.apiVersion ?? DEFAULT_API_VERSION}`,
    fetch: customFetch,
    apiKey: GATEWAY_PLACEHOLDER_API_KEY,
  });
}

/**
 * Placeholder passed to `createOpenAI` since gateway auth is handled by the custom fetch.
 * `@ai-sdk/openai` requires a non-empty `apiKey`; this value is never sent over the wire
 * because `createAIGatewayFetch` replaces the Authorization header for gateway URLs.
 */
const GATEWAY_PLACEHOLDER_API_KEY = 'ai-gateway-auth-via-fetch';

export { resolveGatewayBaseURL };
