import { describe, it, expect, beforeEach } from 'vitest';
import { createMockTransport, type MockTransport } from '../mock-transport';
import { API_PATHS } from '../../runtime/paths';
import type { RequestConfig } from '../../runtime/config';

function makeConfig(path: string, body?: unknown): RequestConfig {
  return {
    url: `https://api.example.com${path}`,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(response: Response): Promise<any> {
  return response.json();
}

describe('createMockTransport', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = createMockTransport();
  });

  describe('default handlers', () => {
    it('returns mock ChatCompletion for /chat/completions', async () => {
      const config = makeConfig(API_PATHS.ChatCompletions, {
        model: 'gpt-4.1-nano',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const response = await transport.request(config);
      expect(response.status).toBe(200);

      const data = await json(response);
      expect(data.object).toBe('chat.completion');
      expect(data.model).toBe('gpt-4.1-nano');
      expect(data.choices[0].message.content).toBe('Mock response');
    });

    it('returns mock ResponseObject for /responses', async () => {
      const response = await transport.request(makeConfig(API_PATHS.Responses, { model: 'gpt-4.1-nano', input: 'Hi' }));
      const data = await json(response);
      expect(data.object).toBe('response');
      expect(data.status).toBe('completed');
    });

    it('returns mock embeddings for /embeddings', async () => {
      const response = await transport.request(
        makeConfig(API_PATHS.Embeddings, { model: 'text-embedding-3-small', input: 'test' }),
      );
      const data = await json(response);
      expect(data.object).toBe('list');
      expect(data.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('returns mock image for /images/generations', async () => {
      const response = await transport.request(makeConfig(API_PATHS.ImagesGenerations, { prompt: 'cat' }));
      const data = await json(response);
      expect(data.data[0].url).toBe('https://mock.test/image.png');
    });

    it('returns mock image for /images/edits', async () => {
      const response = await transport.request(makeConfig(API_PATHS.ImagesEdits));
      expect(response.status).toBe(200);
    });

    it('returns mock transcription for /audio/transcriptions', async () => {
      const response = await transport.request(makeConfig(API_PATHS.AudioTranscriptions));
      const data = await json(response);
      expect(data.text).toBe('Mock transcription');
    });

    it('returns SSE for streaming chat requests by default', async () => {
      const response = await transport.request(
        makeConfig(API_PATHS.ChatCompletions, { model: 'gpt-4.1-nano', messages: [], stream: true }),
      );

      expect(response.headers.get('content-type')).toContain('text/event-stream');
      const text = await response.text();
      expect(text).toContain('"chat.completion.chunk"');
      expect(text).toContain('[DONE]');
    });

    it('returns SSE for streaming responses requests by default', async () => {
      const response = await transport.request(makeConfig(API_PATHS.Responses, { model: 'gpt-4.1-nano', input: 'Hi', stream: true }));

      expect(response.headers.get('content-type')).toContain('text/event-stream');
      const text = await response.text();
      expect(text).toContain('"response.output_text.delta"');
      expect(text).toContain('[DONE]');
    });

    it('returns SSE for streaming transcription requests by default', async () => {
      const form = new FormData();
      form.append('file', new Blob(['audio']), 'audio.mp3');
      form.append('model', 'whisper-1');
      form.append('stream', 'true');

      const response = await transport.request({
        url: `https://api.example.com${API_PATHS.AudioTranscriptions}`,
        method: 'POST',
        headers: {},
        body: form,
      });

      expect(response.headers.get('content-type')).toContain('text/event-stream');
      const text = await response.text();
      expect(text).toContain('"transcript.text.delta"');
      expect(text).toContain('[DONE]');
    });

    it('returns mock translation for /audio/translations', async () => {
      const response = await transport.request(makeConfig(API_PATHS.AudioTranslations));
      const data = await json(response);
      expect(data.text).toBe('Mock translation');
    });

    it('returns mock model info for /model/info', async () => {
      const response = await transport.request(makeConfig(API_PATHS.ModelInfo));
      const data = await json(response);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].model_name).toBe('mock-model');
    });

    it('returns 404 for unknown routes', async () => {
      const response = await transport.request(makeConfig('/api/v1/unknown'));
      expect(response.status).toBe(404);
    });
  });

  describe('request tracking', () => {
    it('captures all requests', async () => {
      await transport.request(makeConfig(API_PATHS.ChatCompletions, { model: 'a' }));
      await transport.request(makeConfig(API_PATHS.Embeddings, { model: 'b' }));

      expect(transport.requestCount).toBe(2);
      expect(transport.requests[0].body).toEqual({ model: 'a' });
      expect(transport.requests[1].body).toEqual({ model: 'b' });
    });

    it('records matched route', async () => {
      await transport.request(makeConfig(API_PATHS.ChatCompletions, { model: 'x' }));
      expect(transport.requests[0].matchedRoute).toBeUndefined(); // default handler, no custom route
    });

    it('records matched custom route', async () => {
      transport.onRoute('/chat/completions', () => new Response('ok'));
      await transport.request(makeConfig(API_PATHS.ChatCompletions));
      expect(transport.requests[0].matchedRoute).toBe('/chat/completions');
    });
  });

  describe('onRoute', () => {
    it('overrides default handler for a path', async () => {
      transport.onRoute(
        '/chat/completions',
        (_config, body) =>
          new Response(JSON.stringify({ custom: true, model: (body as { model: string })?.model }), {
            status: 200,
          }),
      );

      const response = await transport.request(makeConfig(API_PATHS.ChatCompletions, { model: 'custom-model' }));
      const data = await json(response);
      expect(data.custom).toBe(true);
      expect(data.model).toBe('custom-model');
    });

    it('can simulate errors', async () => {
      transport.onRoute(
        '/chat/completions',
        () => new Response(JSON.stringify({ error: 'overloaded' }), { status: 503 }),
      );

      const response = await transport.request(makeConfig(API_PATHS.ChatCompletions));
      expect(response.status).toBe(503);
    });

    it('does not affect other routes', async () => {
      transport.onRoute('/chat/completions', () => new Response(JSON.stringify({ custom: true }), { status: 200 }));

      const embResponse = await transport.request(makeConfig(API_PATHS.Embeddings, { input: 'x' }));
      const data = await json(embResponse);
      expect(data.object).toBe('list');
    });

    it('chains', () => {
      const result = transport
        .onRoute('/chat/completions', () => new Response('ok'))
        .onRoute('/embeddings', () => new Response('ok'));
      expect(result).toBe(transport);
    });
  });

  describe('onAny', () => {
    it('catches unmatched routes', async () => {
      transport.onAny(() => new Response(JSON.stringify({ fallback: true }), { status: 200 }));

      const response = await transport.request(makeConfig('/api/v1/unknown'));
      expect(response.status).toBe(200);
      const data = await json(response);
      expect(data.fallback).toBe(true);
    });

    it('is lower priority than onRoute', async () => {
      transport.onAny(() => new Response('fallback'));
      transport.onRoute('/chat/completions', () => new Response('route'));

      const response = await transport.request(makeConfig(API_PATHS.ChatCompletions));
      expect(await response.text()).toBe('route');
    });
  });

  describe('reset', () => {
    it('clears requests, routes, and fallback', async () => {
      transport.onRoute('/chat/completions', () => new Response('custom'));
      transport.onAny(() => new Response('fallback'));
      await transport.request(makeConfig(API_PATHS.ChatCompletions));

      transport.reset();

      expect(transport.requestCount).toBe(0);

      const response = await transport.request(makeConfig(API_PATHS.ChatCompletions, { model: 'x' }));
      const data = await json(response);
      expect(data.object).toBe('chat.completion'); // back to default

      const unknownResponse = await transport.request(makeConfig('/api/v1/unknown'));
      expect(unknownResponse.status).toBe(404); // fallback cleared
    });

    it('chains', () => {
      expect(transport.reset()).toBe(transport);
    });
  });

  describe('body parsing', () => {
    it('parses JSON body', async () => {
      await transport.request(makeConfig(API_PATHS.ChatCompletions, { hello: 'world' }));
      expect(transport.requests[0].body).toEqual({ hello: 'world' });
    });

    it('handles missing body', async () => {
      await transport.request(makeConfig(API_PATHS.ModelInfo));
      expect(transport.requests[0].body).toBeUndefined();
    });

    it('handles non-JSON body gracefully', async () => {
      const config: RequestConfig = {
        url: `https://api.example.com${API_PATHS.AudioTranscriptions}`,
        method: 'POST',
        headers: {},
        body: 'raw-text-body',
      };
      await transport.request(config);
      expect(transport.requests[0].body).toBe('raw-text-body');
    });

    it('summarizes multipart FormData bodies and preserves the raw body', async () => {
      const form = new FormData();
      form.append('file', new Blob(['audio data'], { type: 'audio/mp3' }), 'audio.mp3');
      form.append('model', 'whisper-1');
      form.append('timestamp_granularities[]', 'word');
      form.append('timestamp_granularities[]', 'segment');

      await transport.request({
        url: `https://api.example.com${API_PATHS.AudioTranscriptions}`,
        method: 'POST',
        headers: {},
        body: form,
      });

      expect(transport.requests[0].body).toEqual({
        file: { kind: 'blob', name: 'audio.mp3', type: 'audio/mp3', size: 10 },
        model: 'whisper-1',
        'timestamp_granularities[]': ['word', 'segment'],
      });
      expect(transport.requests[0].rawBody).toBe(form);
    });
  });
});
