/**
 * Advanced low-level AI Gateway HTTP client.
 *
 * Prefer `@macpaw/ai-sdk/provider` for Vercel AI SDK applications.
 * Import this entry when you need multipart APIs, explicit middleware hooks,
 * or direct Gateway HTTP control outside the provider model.
 * Import `@macpaw/ai-sdk/runtime` for advanced transport and request-pipeline primitives.
 */

export { createAIGatewayClient } from './client';
export type {
  AIGatewayClient,
  ChatCompletionsAPI,
  ResponsesAPI,
  EmbeddingsAPI,
  ModelsAPI,
  ImagesAPI,
  AudioAPI,
} from './client';

export type { AIGatewayClientConfig } from './runtime/config';
