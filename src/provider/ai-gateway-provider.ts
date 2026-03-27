/**
 * Vercel AI SDK-compatible provider for AI Gateway.
 *
 * Creates a strongly typed OpenAI-compatible provider backed by the gateway,
 * making it easy to plug AI Gateway into apps that continue to import
 * `generateText`, `streamText`, and related primitives from the upstream `ai` package.
 */

import { createOpenAI as builtinCreateOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider, OpenAIProviderSettings } from '@ai-sdk/openai';
import { createAIGatewayFetch } from './create-fetch';
import type { Environment, GatewaySharedConfig } from '../runtime/config';
import { resolveGatewayBaseURL as resolveRuntimeGatewayBaseURL } from '../runtime/config';

const DEFAULT_API_VERSION = 'v1';

const GATEWAY_PLACEHOLDER_API_KEY = 'ai-gateway-auth-via-fetch';

export interface AIGatewayProviderOptions
  extends Omit<OpenAIProviderSettings, 'apiKey' | 'baseURL' | 'fetch'>,
    GatewaySharedConfig {
  /**
   * Optional override for the OpenAI provider factory.
   * Uses `createOpenAI` from `@ai-sdk/openai` by default.
   */
  createOpenAI?: typeof builtinCreateOpenAI;
  /**
   * Normalize gateway error responses into `AIGatewayError`. Default: true.
   * When enabled, non-OK gateway responses throw instead of returning a failed Response.
   */
  normalizeErrors?: boolean;
}

function resolveGatewayBaseURL(baseURL?: string, env?: Environment): string {
  return resolveRuntimeGatewayBaseURL(baseURL, env, 'AIGatewayProvider');
}

/**
 * Creates a Vercel AI SDK-compatible provider backed by AI Gateway.
 *
 * The returned value is a fully typed `OpenAIProvider`, so existing apps can
 * keep using their `ai-sdk` helpers and model-selection patterns.
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
    baseURL: `${baseURL.replace(/\/$/, '')}/api/${DEFAULT_API_VERSION}`,
    fetch: customFetch,
    apiKey: GATEWAY_PLACEHOLDER_API_KEY,
  });
}

/**
 * Placeholder passed to `createOpenAI` since gateway auth is handled by the custom fetch.
 * `@ai-sdk/openai` requires a non-empty `apiKey`; this value is never sent over the wire
 * because `createAIGatewayFetch` replaces the Authorization header for gateway URLs.
 */
export { resolveGatewayBaseURL };
