/**
 * Vercel AI SDK-compatible provider for AI Gateway.
 *
 * Creates a provider that wraps @ai-sdk/openai with AI Gateway auth
 * and error handling baked in. Works with generateText, streamText,
 * useChat, and all Vercel AI SDK hooks.
 *
 * @example
 * ```ts
 * import { createOpenAI } from '@ai-sdk/openai';
 * import { createAIGatewayProvider } from '@macpaw/ai-sdk/provider';
 * import { generateText } from 'ai';
 *
 * const gateway = createAIGatewayProvider({
 *   createOpenAI,
 *   getAuthToken: async () => myToken,
 *   env: 'production',
 * });
 *
 * const { text } = await generateText({
 *   model: gateway('openai/gpt-4.1-nano'),
 *   prompt: 'Hello!',
 * });
 * ```
 */

import { createAIGatewayFetch } from './create-fetch';
import type { Environment } from '../core/config';
import { DEFAULT_BASE_URLS } from '../core/config';

type CreateOpenAIFn = (config: {
  baseURL: string;
  fetch: typeof globalThis.fetch;
  apiKey: string;
}) => CreateOpenAIReturn;

type CreateOpenAIReturn = ((modelId: string, settings?: Record<string, unknown>) => unknown) & {
  chat: (modelId: string, settings?: Record<string, unknown>) => unknown;
  completion: (modelId: string, settings?: Record<string, unknown>) => unknown;
  embedding: (modelId: string, settings?: Record<string, unknown>) => unknown;
  [key: string]: unknown;
};

export interface AIGatewayProviderOptions {
  /**
   * The createOpenAI function from @ai-sdk/openai.
   * Pass it directly to avoid SDK depending on @ai-sdk/openai.
   *
   * @example
   * import { createOpenAI } from '@ai-sdk/openai';
   */
  createOpenAI: CreateOpenAIFn;
  /** Base URL of the AI Gateway BFF. Required if env is not set. */
  baseURL?: string;
  /** Environment: 'production' selects the default base URL. For non-production, use baseURL instead. */
  env?: Environment;
  /** Async function that returns the Bearer token. */
  getAuthToken: () => Promise<string | null>;
  /** Extra headers for every request. */
  headers?: Record<string, string>;
}

/**
 * Creates a Vercel AI SDK-compatible provider backed by AI Gateway.
 *
 * The returned object works as both a function and has `.chat`, `.completion`,
 * `.embedding` methods matching the @ai-sdk/openai provider interface.
 *
 * Handles:
 * - Auth token injection via custom fetch
 * - URL routing to AI Gateway BFF
 * - All model types supported by @ai-sdk/openai
 */
export function createAIGatewayProvider(options: AIGatewayProviderOptions): CreateOpenAIReturn {
  const baseURL = options.baseURL ?? (options.env ? DEFAULT_BASE_URLS[options.env] : undefined);
  if (!baseURL) {
    throw new Error('AIGatewayProvider requires baseURL or env (production). For non-production environments, pass baseURL directly.');
  }

  const customFetch = createAIGatewayFetch({
    baseURL,
    getAuthToken: options.getAuthToken,
    headers: options.headers,
  });

  return options.createOpenAI({
    baseURL: `${baseURL.replace(/\/$/, '')}/api/v1`,
    fetch: customFetch as unknown as typeof globalThis.fetch,
    apiKey: 'unused',
  });
}
