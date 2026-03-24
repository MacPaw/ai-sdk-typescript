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
  rawBody: RequestConfig['body'];
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

function sseResponse(events: unknown[]): Response {
  const payload =
    [...events.map((event) => `data: ${JSON.stringify(event)}`), 'data: [DONE]'].join('\n\n') + '\n\n';
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function wantsStream(body: unknown): boolean {
  return (body as Record<string, unknown> | undefined)?.stream === true || (body as Record<string, unknown> | undefined)?.stream === 'true';
}

function defaultHandler(path: string, body: unknown): Response {
  const model = (body as Record<string, unknown>)?.model as string | undefined;

  if (path.endsWith(API_PATHS.ChatCompletions)) {
    if (wantsStream(body)) {
      return sseResponse([
        {
          id: 'chatcmpl-mock-0',
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model ?? 'mock-model',
          choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
          usage: null,
        },
        {
          id: 'chatcmpl-mock-1',
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model ?? 'mock-model',
          choices: [{ index: 0, delta: { content: 'Mock response' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        },
      ]);
    }
    return jsonResponse(createMockChatCompletion({ model }));
  }
  if (path.endsWith(API_PATHS.Responses)) {
    if (wantsStream(body)) {
      return sseResponse([
        { type: 'response.output_text.delta', delta: 'Mock response' },
        {
          type: 'response.completed',
          response: createMockResponseObject({ model, content: 'Mock response' }),
        },
      ]);
    }
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
    if (wantsStream(body)) {
      return sseResponse([
        { type: 'transcript.text.delta', delta: 'Mock ' },
        { type: 'transcript.text.delta', delta: 'transcription' },
        { type: 'transcript.text.done', text: 'Mock transcription' },
      ]);
    }
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

function summarizeFormDataValue(value: string | Blob): unknown {
  if (typeof value === 'string') return value;

  const fileLike = value as Blob & { name?: string };
  return {
    kind: 'blob',
    name: fileLike.name,
    type: value.type,
    size: value.size,
  };
}

function appendFormField(target: Record<string, unknown>, key: string, value: unknown): void {
  if (!(key in target)) {
    target[key] = value;
    return;
  }

  const existing = target[key];
  target[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
}

async function parseBody(config: RequestConfig): Promise<unknown> {
  if (!config.body) return undefined;
  if (typeof config.body === 'string') {
    try {
      return JSON.parse(config.body);
    } catch {
      return config.body;
    }
  }
  if (typeof FormData !== 'undefined' && config.body instanceof FormData) {
    const fields: Record<string, unknown> = {};
    for (const [key, value] of config.body.entries()) {
      appendFormField(fields, key, summarizeFormDataValue(value));
    }
    return fields;
  }
  return config.body;
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
 * // Multipart bodies are summarized into plain objects; the original body is on rawBody.
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
      const body = await parseBody(config);
      const match = findRoute(config.url);

      requests.push({
        config,
        body,
        rawBody: config.body,
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
