import { File as NodeFile } from 'node:buffer';
import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import { createTranscriptionClient } from '../gateway-transcriptions';
import { DEFAULT_TRANSCRIPTION_TIMEOUT_MS } from '../gateway-transcriptions';
import type {
  CreateTranscriptionRequest,
  TranscriptionRequestOptions,
  TranscriptionResponse,
} from '../gateway-transcriptions';
import { AuthError, CreditsError, ModelNotAllowedError, AIGatewayError, RateLimitError } from '../gateway-errors';
import { DEFAULT_BASE_URLS } from '../gateway-config';

const BASE_URL = 'https://api.macpaw.com/ai';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// Node 18 has no global `File` (added in Node 20); `node:buffer` exports it from 18.13.
const FileCtor: typeof File = (globalThis as { File?: typeof File }).File ?? (NodeFile as unknown as typeof File);

function audioFile(name = 'meeting.mp3'): File {
  return new FileCtor([new Uint8Array([1, 2, 3])], name, { type: 'audio/mpeg' });
}

function lastForm(): FormData {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  const body = calls[calls.length - 1][1].body;
  expect(body).toBeInstanceOf(FormData);
  return body as FormData;
}

describe('createTranscriptionClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockImplementation(async () => jsonResponse({ text: 'Hello world.' }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ─── factory options ──────────────────────────────────────────────────────

  describe('factory options', () => {
    it('accepts env: "production" and resolves the production base URL', async () => {
      const client = createTranscriptionClient({ env: 'production', getAuthToken: async () => 'my-jwt' });

      await client.create({ model: 'openai/gpt-4o-transcribe', file: audioFile() });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${DEFAULT_BASE_URLS.production}/v2/audio/transcriptions`);
    });

    it('defaults the timeout to DEFAULT_TRANSCRIPTION_TIMEOUT_MS and honors an explicit timeout', async () => {
      expect(DEFAULT_TRANSCRIPTION_TIMEOUT_MS).toBe(600_000);
      vi.useFakeTimers();
      try {
        const hang = (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
          });

        (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(hang);
        const byDefault = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
        const pendingDefault = byDefault.create({ model: 'openai/whisper-1', file: audioFile() });
        const settledDefault = pendingDefault.catch((e: unknown) => e);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(await Promise.race([settledDefault, Promise.resolve('still-pending')])).toBe('still-pending');
        await vi.advanceTimersByTimeAsync(DEFAULT_TRANSCRIPTION_TIMEOUT_MS - 60_000);
        expect(String(await settledDefault)).toMatch(/timed out after 600000ms/);

        (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(hang);
        const custom = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token', timeout: 5 });
        const settledCustom = custom.create({ model: 'openai/whisper-1', file: audioFile() }).catch((e: unknown) => e);
        await vi.advanceTimersByTimeAsync(5);
        expect(String(await settledCustom)).toMatch(/timed out after 5ms/);
      } finally {
        vi.useRealTimers();
      }
    });

    it('throws when neither baseURL nor env is provided', () => {
      expect(() => createTranscriptionClient({ getAuthToken: async () => 'token' })).toThrow(/requires baseURL or env/);
    });
  });

  // ─── create() — request shape ──────────────────────────────────────────────

  describe('create() request', () => {
    it('sends multipart POST to /v2/audio/transcriptions with Authorization and no JSON Content-Type', async () => {
      const client = createTranscriptionClient({ baseURL: `${BASE_URL}/`, getAuthToken: async () => 'my-jwt' });

      await client.create({ model: 'openai/gpt-4o-transcribe', file: audioFile() });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe(`${BASE_URL}/v2/audio/transcriptions`);
      expect(fetchCall[1].method).toBe('POST');
      const headers = new Headers(fetchCall[1].headers);
      expect(headers.get('Authorization')).toBe('Bearer my-jwt');
      // fetch sets multipart/form-data with the boundary itself.
      expect(headers.get('Content-Type')).toBeNull();
    });

    it('sends the File with its own name, model and language', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.create({ model: 'elevenlabs/scribe_v2', file: audioFile('call.wav'), language: 'en' });

      const form = lastForm();
      expect(form.get('model')).toBe('elevenlabs/scribe_v2');
      expect(form.get('language')).toBe('en');
      const file = form.get('file') as File;
      expect(file).toBeInstanceOf(Blob);
      expect(file.name).toBe('call.wav');
      expect(form.has('filename')).toBe(false);
    });

    it('uses `filename` for a plain Blob, and "audio" when none is given', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.create({ model: 'openai/whisper-1', file: new Blob([new Uint8Array([1])]), filename: 'clip.m4a' });
      expect((lastForm().get('file') as File).name).toBe('clip.m4a');

      await client.create({ model: 'openai/whisper-1', file: new Blob([new Uint8Array([1])]) });
      expect((lastForm().get('file') as File).name).toBe('audio');
    });

    it('sends source_url without a file part', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.create({ model: 'elevenlabs/scribe_v2', source_url: 'https://cdn.example.com/audio/meeting.mp3' });

      const form = lastForm();
      expect(form.get('source_url')).toBe('https://cdn.example.com/audio/meeting.mp3');
      expect(form.has('file')).toBe(false);
    });

    it('forwards provider fields under the exact key given, arrays as repeated parts', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.create({
        model: 'openai/whisper-1',
        file: audioFile(),
        response_format: 'verbose_json',
        'timestamp_granularities[]': ['word', 'segment'],
        'include[]': ['logprobs'],
      });

      const form = lastForm();
      expect(form.getAll('timestamp_granularities[]')).toEqual(['word', 'segment']);
      expect(form.getAll('include[]')).toEqual(['logprobs']);
      expect(form.has('timestamp_granularities')).toBe(false);
      expect(form.get('response_format')).toBe('verbose_json');
    });

    it('sends repeated parts without renaming keys, and stringifies scalars', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.create({
        model: 'elevenlabs/scribe_v2',
        file: audioFile(),
        diarize: true,
        tag_audio_events: false,
        num_speakers: 2,
        keyterms: ['MacPaw', 'CleanMyMac'],
        timestamps_granularity: 'word',
      });

      const form = lastForm();
      expect(form.getAll('keyterms')).toEqual(['MacPaw', 'CleanMyMac']);
      expect(form.has('keyterms[]')).toBe(false);
      expect(form.get('diarize')).toBe('true');
      expect(form.get('tag_audio_events')).toBe('false');
      expect(form.get('num_speakers')).toBe('2');
      expect(form.get('timestamps_granularity')).toBe('word');
    });

    it('JSON-encodes an object chunking_strategy, skips undefined, and passes through unknown fields', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.create({
        model: 'openai/gpt-4o-transcribe-diarize',
        file: audioFile(),
        chunking_strategy: { type: 'server_vad', threshold: 0.5 },
        prompt: undefined,
        some_future_field: 'x',
      });

      const form = lastForm();
      expect(JSON.parse(form.get('chunking_strategy') as string)).toEqual({ type: 'server_vad', threshold: 0.5 });
      expect(form.has('prompt')).toBe(false);
      expect(form.get('some_future_field')).toBe('x');
    });

    it('forwards Blob values in extra fields as file parts, not "{}"', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
      const reference = new FileCtor([new Uint8Array([9, 9])], 'speaker.wav', { type: 'audio/wav' });

      await client.create({
        model: 'x/future-model',
        file: audioFile(),
        reference_audio: reference,
        reference_clips: [new Blob([new Uint8Array([1])]), new Blob([new Uint8Array([2])])],
      });

      const form = lastForm();
      const sent = form.get('reference_audio') as File;
      expect(sent).toBeInstanceOf(Blob);
      expect(sent.name).toBe('speaker.wav');
      expect(sent.size).toBe(2);
      const clips = form.getAll('reference_clips');
      expect(clips).toHaveLength(2);
      for (const clip of clips) expect(clip).toBeInstanceOf(Blob);
    });

    it('forwards Uint8Array / ArrayBuffer / Buffer extra fields as file parts, and Dates as ISO strings', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.create({
        model: 'x/future-model',
        file: audioFile(),
        typed: new Uint8Array([1, 2, 3]),
        raw: new Uint8Array([4, 5]).buffer,
        node_buffer: Buffer.from([6]),
        recorded_at: new Date('2026-11-23T10:00:00.000Z'),
      });

      const form = lastForm();
      for (const [key, size] of [
        ['typed', 3],
        ['raw', 2],
        ['node_buffer', 1],
      ] as const) {
        const part = form.get(key);
        expect(part).toBeInstanceOf(Blob);
        expect((part as Blob).size).toBe(size);
      }
      expect(new Uint8Array(await (form.get('typed') as Blob).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
      expect(form.get('recorded_at')).toBe('2026-11-23T10:00:00.000Z');
    });

    it('accepts raw bytes (Buffer / ArrayBuffer) as file, named by filename or "audio"', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.create({ model: 'openai/whisper-1', file: Buffer.from([1, 2, 3, 4]), filename: 'a.mp3' });
      let part = lastForm().get('file') as File;
      expect(part).toBeInstanceOf(Blob);
      expect(part.size).toBe(4);
      expect(part.name).toBe('a.mp3');

      await client.create({ model: 'openai/whisper-1', file: new Uint8Array([1, 2]).buffer });
      part = lastForm().get('file') as File;
      expect(part.size).toBe(2);
      expect(part.name).toBe('audio');
    });

    it('treats file: null as absent and rejects other non-binary file values with a clear TypeError', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await client.create({
        model: 'elevenlabs/scribe_v2',
        source_url: 'https://cdn.example.com/a.mp3',
        file: null as unknown as undefined,
      });
      expect(lastForm().has('file')).toBe(false);

      const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      await expect(client.create({ model: 'openai/whisper-1', file: 'not-bytes' as unknown as Blob })).rejects.toThrow(
        TypeError,
      );
      await expect(client.create({ model: 'openai/whisper-1', file: 'not-bytes' as unknown as Blob })).rejects.toThrow(
        /`file` must be a Blob, File, ArrayBuffer, typed array or Buffer/,
      );
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCalls);
    });

    it('drops a Content-Type configured in headers so fetch sets the multipart boundary', async () => {
      const client = createTranscriptionClient({
        baseURL: BASE_URL,
        getAuthToken: async () => 'token',
        headers: { 'content-type': 'application/json', 'X-App': 'demo' },
      });

      await client.create({ model: 'openai/whisper-1', file: audioFile() });

      const headers = new Headers((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers);
      expect(headers.get('Content-Type')).toBeNull();
      expect(headers.get('X-App')).toBe('demo');
    });

    it('passes the per-call AbortSignal to fetch and rejects when it is aborted', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            if (init.signal?.aborted) return reject(init.signal.reason);
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
          }),
      );
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
      const controller = new AbortController();

      const pending = client.create({ model: 'openai/whisper-1', file: audioFile() }, { signal: controller.signal });
      controller.abort(new Error('cancelled by user'));

      await expect(pending).rejects.toThrow('cancelled by user');
    });
  });

  // ─── type surface ─────────────────────────────────────────────────────────

  describe('CreateTranscriptionRequest type', () => {
    it('requires exactly one of file / source_url', () => {
      const ok1: CreateTranscriptionRequest = { model: 'openai/whisper-1', file: audioFile() };
      const ok2: CreateTranscriptionRequest = { model: 'elevenlabs/scribe_v2', source_url: 'https://x.test/a.mp3' };
      // @ts-expect-error — both file and source_url
      const both: CreateTranscriptionRequest = { model: 'm', file: audioFile(), source_url: 'https://x.test/a.mp3' };
      // @ts-expect-error — neither file nor source_url
      const neither: CreateTranscriptionRequest = { model: 'm' };
      expect([ok1, ok2, both, neither]).toHaveLength(4);
    });

    it('types create() results by the stream flag and response kind', async () => {
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });
      const file = audioFile();
      const wantStream = false as boolean; // a flag only known at runtime

      const streamed = client.create({ model: 'm', file, stream: true });
      const byDefault = client.create({ model: 'm', file });
      const notStreamed = client.create({ model: 'm', file, stream: false });
      const asText = client.create<string>({ model: 'm', file, response_format: 'srt' });
      const dynamic = client.create({ model: 'm', file, stream: wantStream });
      // @ts-expect-error — a caller-chosen JSON type cannot be combined with stream: true
      const invalid = client.create<{ text: string }>({ model: 'm', file, stream: true });

      expectTypeOf(streamed).resolves.toEqualTypeOf<Response>();
      expectTypeOf(byDefault).resolves.toEqualTypeOf<TranscriptionResponse | string>();
      expectTypeOf(notStreamed).resolves.toEqualTypeOf<TranscriptionResponse | string>();
      expectTypeOf(asText).resolves.toBeString();
      // A runtime boolean may stream, so the result includes Response.
      expectTypeOf(dynamic).resolves.toEqualTypeOf<TranscriptionResponse | string | Response>();

      await Promise.all([streamed, byDefault, notStreamed, asText, dynamic, invalid]);
    });

    it('accepts raw bytes for file and a per-call signal', () => {
      expectTypeOf<{ model: string; file: Uint8Array }>().toExtend<CreateTranscriptionRequest>();
      expectTypeOf<{ model: string; file: ArrayBuffer }>().toExtend<CreateTranscriptionRequest>();
      expectTypeOf<Parameters<ReturnType<typeof createTranscriptionClient>['create']>[1]>().toEqualTypeOf<
        TranscriptionRequestOptions | undefined
      >();
    });
  });

  // ─── create() — response handling ──────────────────────────────────────────

  describe('create() response', () => {
    it('returns the parsed OpenAI JSON response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse({ text: 'Thanks for calling support.', usage: { type: 'tokens', total_tokens: 78 } }),
      );
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const result = await client.create<{ text: string; usage?: { total_tokens?: number } }>({
        model: 'openai/gpt-4o-transcribe',
        file: audioFile(),
      });

      expect(result.text).toBe('Thanks for calling support.');
      expect(result.usage?.total_tokens).toBe(78);
    });

    it('returns the ElevenLabs multi-channel response unchanged', async () => {
      const body = {
        audio_duration_secs: 4.2,
        transcripts: [{ channel_index: 0, language_code: 'eng', language_probability: 0.98, text: 'Hi', words: [] }],
      };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse(body));
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const result = await client.create({ model: 'elevenlabs/scribe_v2', file: audioFile(), use_multi_channel: true });

      expect(result).toEqual(body);
      if (typeof result === 'string') throw new Error('expected JSON');
      expect(result.transcripts).toHaveLength(1);
    });

    it('returns a string for text/plain responses (srt)', async () => {
      const srt = '1\n00:00:00,000 --> 00:00:02,100\nHello world.\n';
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(srt, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }),
      );
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const result = await client.create<string>({
        model: 'openai/whisper-1',
        file: audioFile(),
        response_format: 'srt',
      });

      expect(result).toBe(srt);
    });

    it('returns the raw Response when stream is true', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('data: {"type":"transcript.text.delta","delta":"Hello"}\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      );
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const response: Response = await client.create({
        model: 'openai/gpt-4o-mini-transcribe',
        file: audioFile(),
        stream: true,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(lastForm().get('stream')).toBe('true');
    });

    it('returns the raw Response for text/event-stream even when stream is not the boolean true', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('data: {"type":"transcript.text.delta","delta":"Hello"}\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream; charset=utf-8' },
        }),
      );
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      // Simulates an untyped JS / config caller; typed callers cannot pass a string here.
      const untypedStream = 'true' as unknown as boolean;
      const result = await client.create({
        model: 'openai/gpt-4o-mini-transcribe',
        file: audioFile(),
        stream: untypedStream,
      });

      expect(result).toBeInstanceOf(Response);
      expect(await (result as Response).text()).toContain('transcript.text.delta');
    });

    it('throws AIGatewayError when a JSON response cannot be parsed', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response('not json', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(client.create({ model: 'openai/gpt-4o-transcribe', file: audioFile() })).rejects.toThrow(
        /Failed to parse transcription response/,
      );
    });
  });

  // ─── errors ─────────────────────────────────────────────────────────────────

  describe('create() errors', () => {
    it('retries once with a fresh token on 401, re-sending the form, then throws AuthError', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () =>
        jsonResponse({ statusCode: 401, message: 'Unauthorized access', code: 'UNAUTHORIZED' }, 401),
      );
      const getAuthToken = vi.fn().mockResolvedValue('stale-token');
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken });

      await expect(client.create({ model: 'openai/gpt-4o-transcribe', file: audioFile() })).rejects.toBeInstanceOf(
        AuthError,
      );
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[1][1].body).toBeInstanceOf(FormData);
      expect(getAuthToken).toHaveBeenLastCalledWith(true);
    });

    it('throws AIGatewayError with validation details on 400', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 400,
            code: 'BAD_REQUEST',
            message: 'The request syntax or parameters are invalid',
            path: '/v2/audio/transcriptions',
            timestamp: '2026-10-11T12:00:00.000Z',
            errors: [
              {
                constraints: ['isSupportedProvider'],
                message: 'stream is supported only by openai models',
                property: 'stream',
                target: 'operation.validation',
              },
            ],
          },
          400,
        ),
      );
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client
        .create({ model: 'elevenlabs/scribe_v2', file: audioFile(), stream: true })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AIGatewayError);
      expect((err as AIGatewayError).statusCode).toBe(400);
      expect((err as AIGatewayError).metadata.errors?.[0]?.property).toBe('stream');
    });

    it('throws CreditsError on 402 (PAYMENT_REQUIRED)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 402,
            code: 'PAYMENT_REQUIRED',
            message: 'insufficient_credits',
            path: '/v2/audio/transcriptions',
            timestamp: '2026-10-11T12:00:00.000Z',
            errors: [{ metadata: { paymentUrl: 'https://account.setapp.com/get-credits' } }],
          },
          402,
        ),
      );
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      const err = await client.create({ model: 'openai/gpt-4o-transcribe', file: audioFile() }).catch((e) => e);

      expect(err).toBeInstanceOf(CreditsError);
      expect((err as CreditsError).metadata.paymentUrl).toBe('https://account.setapp.com/get-credits');
    });

    it('throws ModelNotAllowedError on 403 (upstream team_model_access_denied envelope)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: '403',
              message: 'team not allowed to access model. Tried to access elevenlabs/scribe_v9',
              param: 'model',
              type: 'team_model_access_denied',
            },
          },
          403,
        ),
      );
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(client.create({ model: 'elevenlabs/scribe_v9', file: audioFile() })).rejects.toBeInstanceOf(
        ModelNotAllowedError,
      );
    });

    it('throws RateLimitError on 429 without retrying (create() disables config-level retries)', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () =>
        jsonResponse({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' }, 429),
      );
      const client = createTranscriptionClient({ baseURL: BASE_URL, getAuthToken: async () => 'token' });

      await expect(client.create({ model: 'openai/gpt-4o-transcribe', file: audioFile() })).rejects.toBeInstanceOf(
        RateLimitError,
      );
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    });
  });
});
