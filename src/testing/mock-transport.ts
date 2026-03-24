/**
 * A mock `Transport` for integration-style tests.
 * Plug into `createAIGatewayClient({ transport: createMockTransport() })` and
 * the real client pipeline runs — auth, middleware, retry — without network calls.
 */

import type { Transport, RequestConfig } from '../runtime/config';
import { API_PATHS } from '../runtime/paths';
import {
  createMockChatCompletion,
  createMockResponseObject,
  createMockEmbeddingResponse,
  createMockImageResponse,
  createMockTranscriptionResponse,
  createMockTranslationResponse,
  createMockModelInfoResponse,
} from './mock-data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MockRouteHandler = (config: RequestConfig, body: unknown) => Response | Promise<Response>;

export interface MockTransportRequest {
  config: RequestConfig;
  body: unknown;
  matchedRoute: string | undefined;
  timestamp: number;
}

export interface MockTransport extends Transport {
  /** All captured requests, newest last. */
  readonly requests: readonly MockTransportRequest[];
  /** Number of requests captured. */
  readonly requestCount: number;
  /** Register a custom handler for a URL path suffix (e.g. `/chat/completions`). */
  onRoute(pathSuffix: string, handler: MockRouteHandler): MockTransport;
  /** Register a handler that matches any URL. Lowest priority — only used when no route matches. */
  onAny(handler: MockRouteHandler): MockTransport;
  /** Remove all custom handlers and clear request history. */
  reset(): MockTransport;
}

// ---------------------------------------------------------------------------
// Default response builders
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function defaultHandler(path: string, body: unknown): Response {
  const model = (body as Record<string, unknown>)?.model as string | undefined;

  if (path.endsWith(API_PATHS.ChatCompletions)) {
    return jsonResponse(createMockChatCompletion({ model }));
  }
  if (path.endsWith(API_PATHS.Responses)) {
    return jsonResponse(createMockResponseObject({ model }));
  }
  if (path.endsWith(API_PATHS.Embeddings)) {
    return jsonResponse(createMockEmbeddingResponse({ model }));
  }
  if (path.endsWith(API_PATHS.ImagesGenerations)) {
    return jsonResponse(createMockImageResponse());
  }
  if (path.endsWith(API_PATHS.ImagesEdits)) {
    return jsonResponse(createMockImageResponse());
  }
  if (path.endsWith(API_PATHS.AudioTranscriptions)) {
    return jsonResponse(createMockTranscriptionResponse());
  }
  if (path.endsWith(API_PATHS.AudioTranslations)) {
    return jsonResponse(createMockTranslationResponse());
  }
  if (path.endsWith(API_PATHS.ModelInfo)) {
    return jsonResponse(createMockModelInfoResponse());
  }

  return jsonResponse({ error: 'MOCK_TRANSPORT_NO_ROUTE', path }, 404);
}

// ---------------------------------------------------------------------------
// Parse body from RequestConfig
// ---------------------------------------------------------------------------

function parseBody(config: RequestConfig): unknown {
  if (!config.body || typeof config.body !== 'string') return undefined;
  try {
    return JSON.parse(config.body);
  } catch {
    return config.body;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a mock `Transport` that returns fixture data for every SDK endpoint.
 *
 * Plugs directly into the real client — auth, middleware, retry all execute normally,
 * only HTTP is stubbed.
 *
 * @example
 * ```ts
 * import { createAIGatewayClient } from '@macpaw/ai-sdk/client';
 * import { createMockTransport } from '@macpaw/ai-sdk/testing';
 *
 * const transport = createMockTransport();
 * const client = createAIGatewayClient({
 *   env: 'production',
 *   getAuthToken: async () => 'test-token',
 *   transport,
 * });
 *
 * // Uses real client pipeline, no network
 * const completion = await client.chat.completions.create({
 *   model: 'openai/gpt-4.1-nano',
 *   messages: [{ role: 'user', content: 'Hi' }],
 * });
 *
 * // Inspect captured requests
 * console.log(transport.requestCount);         // 1
 * console.log(transport.requests[0].body);      // { model: '...', messages: [...] }
 *
 * // Custom handler for a specific route
 * transport.onRoute('/chat/completions', (_config, body) => {
 *   return new Response(JSON.stringify({ error: 'overloaded' }), { status: 503 });
 * });
 * ```
 */
export function createMockTransport(): MockTransport {
  const requests: MockTransportRequest[] = [];
  const routes = new Map<string, MockRouteHandler>();
  let fallback: MockRouteHandler | undefined;

  function findRoute(url: string): [string, MockRouteHandler] | undefined {
    for (const [suffix, handler] of routes) {
      if (url.includes(suffix)) return [suffix, handler];
    }
    return undefined;
  }

  const transport: MockTransport = {
    get requests() {
      return requests;
    },
    get requestCount() {
      return requests.length;
    },

    async request(config: RequestConfig): Promise<Response> {
      const body = parseBody(config);
      const match = findRoute(config.url);

      requests.push({
        config,
        body,
        matchedRoute: match?.[0],
        timestamp: Date.now(),
      });

      if (match) {
        return match[1](config, body);
      }
      if (fallback) {
        return fallback(config, body);
      }
      return defaultHandler(config.url, body);
    },

    onRoute(pathSuffix: string, handler: MockRouteHandler) {
      routes.set(pathSuffix, handler);
      return transport;
    },

    onAny(handler: MockRouteHandler) {
      fallback = handler;
      return transport;
    },

    reset() {
      requests.length = 0;
      routes.clear();
      fallback = undefined;
      return transport;
    },
  };

  return transport;
}
