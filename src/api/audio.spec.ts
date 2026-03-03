import { describe, it, expect, vi } from 'vitest';
import { createTranscription, createTranscriptionStream, createTranslation } from './audio';
import type { ResolvedConfig } from '../core/config';

function createMockConfig(response: Response): ResolvedConfig {
  return {
    baseURL: 'https://api.example.com/ai',
    getAuthToken: vi.fn().mockResolvedValue('token'),
    autoRefreshToken: false,
    tokenCacheTTL: 0,
    transport: { request: vi.fn().mockResolvedValue(response) },
    retry: false,
    middleware: [],
    timeout: 5000,
    logger: {},
    hooks: {},
    generateRequestId: false,
  };
}

describe('createTranscription', () => {
  it('sends multipart POST to /api/v1/audio/transcriptions and returns transcription', async () => {
    const transcription = { text: 'Hello world', duration: 2.5, language: 'en' };
    const response = new Response(JSON.stringify(transcription), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);
    const file = new Blob(['audio data'], { type: 'audio/mp3' });

    const result = await createTranscription(config, { file, model: 'whisper-1' });

    expect(result).toEqual(expect.objectContaining({ text: 'Hello world' }));
    const transport = config.transport!;
    const req = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.url).toContain('/api/v1/audio/transcriptions');
    expect(req.method).toBe('POST');
    expect(req.body).toBeInstanceOf(FormData);
  });

  it('includes optional fields in FormData', async () => {
    const response = new Response(JSON.stringify({ text: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);
    const file = new Blob(['audio data'], { type: 'audio/mp3' });

    await createTranscription(config, {
      file,
      model: 'whisper-1',
      language: 'en',
      prompt: 'context',
      response_format: 'verbose_json',
      temperature: 0.2,
      timestamp_granularities: ['word', 'segment'],
    });

    const req = (config.transport!.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const fd = req.body as FormData;
    expect(fd.get('model')).toBe('whisper-1');
    expect(fd.get('language')).toBe('en');
    expect(fd.get('prompt')).toBe('context');
    expect(fd.get('response_format')).toBe('verbose_json');
    expect(fd.get('temperature')).toBe('0.2');
    expect(fd.getAll('timestamp_granularities[]')).toEqual(['word', 'segment']);
  });

  it('supports withResponse option', async () => {
    const transcription = { text: 'Hello' };
    const response = new Response(JSON.stringify(transcription), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);
    const file = new Blob(['audio data'], { type: 'audio/mp3' });

    const result = await createTranscription(config, { file, model: 'whisper-1' }, { withResponse: true });

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('response');
    expect((result as { data: { text: string } }).data.text).toBe('Hello');
  });
});

describe('createTranscriptionStream', () => {
  it('streams transcription events via SSE', async () => {
    const sseData = [
      'data: {"type":"transcript.text.delta","delta":"Hel"}',
      'data: {"type":"transcript.text.delta","delta":"lo"}',
      'data: {"type":"transcript.text.done","text":"Hello"}',
      'data: [DONE]',
    ].join('\n') + '\n';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        controller.close();
      },
    });

    const response = new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    const config = createMockConfig(response);
    const file = new Blob(['audio'], { type: 'audio/mp3' });

    const events = [];
    for await (const event of createTranscriptionStream(config, { file, model: 'whisper-1', stream: true })) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('transcript.text.delta');
    expect(events[0].delta).toBe('Hel');
    expect(events[2].type).toBe('transcript.text.done');
  });
});

describe('createTranslation', () => {
  it('sends multipart POST to /api/v1/audio/translations and returns translation', async () => {
    const translation = { text: 'Translated text', duration: 3.0, language: 'fr' };
    const response = new Response(JSON.stringify(translation), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);
    const file = new Blob(['audio data'], { type: 'audio/mp3' });

    const result = await createTranslation(config, { file, model: 'whisper-1' });

    expect(result).toEqual(expect.objectContaining({ text: 'Translated text' }));
    const req = (config.transport!.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.url).toContain('/api/v1/audio/translations');
    expect(req.method).toBe('POST');
    expect(req.body).toBeInstanceOf(FormData);
  });

  it('includes optional fields in FormData', async () => {
    const response = new Response(JSON.stringify({ text: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);
    const file = new Blob(['audio data'], { type: 'audio/mp3' });

    await createTranslation(config, {
      file,
      model: 'whisper-1',
      prompt: 'translate this',
      response_format: 'srt',
      temperature: 0.3,
    });

    const req = (config.transport!.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const fd = req.body as FormData;
    expect(fd.get('model')).toBe('whisper-1');
    expect(fd.get('prompt')).toBe('translate this');
    expect(fd.get('response_format')).toBe('srt');
    expect(fd.get('temperature')).toBe('0.3');
  });
});
