/**
 * Provider utilities for Vercel AI SDK integration.
 *
 * This is the primary entry point for applications already built on Vercel AI SDK.
 * It provides the AI Gateway provider layer plus a curated set of AI SDK helpers.
 */

export { createAIGatewayFetch } from './create-fetch';
export type { CreateAIGatewayFetchOptions } from './create-fetch';

export { createAIGatewayProvider } from './ai-gateway-provider';
export type { AIGatewayProviderOptions } from './ai-gateway-provider';

export { createAIGatewayCustomProvider } from './custom-registry';
export type { AIGatewayCustomProviderRegistry } from './custom-registry';
export { createAIGatewayDualProvider } from './dual-provider';
export type { AIGatewayDualProviderOptions } from './dual-provider';
export type { AIGatewayProviderSource, OpenAIProviderSource, Resolvable } from './provider-source';

export { createOpenAI } from '@ai-sdk/openai';
export type { OpenAIProvider, OpenAIProviderSettings } from '@ai-sdk/openai';

export {
  customProvider,
  embed,
  embedMany,
  generateObject,
  generateText,
  streamObject,
  streamText,
  wrapLanguageModel,
  createIdGenerator,
  dynamicTool,
  generateId,
  jsonSchema,
  tool,
  zodSchema,
} from 'ai';

export {
  AIGatewayError,
  AIGatewayErrorCodes,
  AuthError,
  CreditsError,
  ModelNotAllowedError,
  RateLimitError,
  ValidationError,
  isAIGatewayError,
  parseErrorResponse,
} from '../runtime/errors';
export type { NormalizedErrorMetadata } from '../runtime/errors';
export { ErrorCode } from '../types';
