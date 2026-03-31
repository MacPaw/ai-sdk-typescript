import { describe, it, expect } from 'vitest';
import { createMockAIGatewayClient } from '../mock-client';
import { createMockStreamTextResult, createMockStreamResponseResult } from '../mock-streams';
import {
  createMockChatCompletion,
  createMockResponseObject,
  createMockEmbeddingResponse,
  createMockImageResponse,
  createMockTranscriptionResponse,
  createMockTranslationResponse,
  createMockModelInfoResponse,
} from '../mock-data';
import type {
  ChatCompletion,
  CreateEmbeddingResponse,
  CreateImageResponse,
  TranscriptionResponse,
  TranslationResponse,
} from '../../types';

describe('createMockAIGatewayClient', () => {
  it('has all expected API namespaces', () => {
    const client = createMockAIGatewayClient();

    expect(client.chat).toBeDefined();
    expect(client.chat.completions).toBeDefined();
    expect(client.chat.completions.create).toBeDefined();
    expect(client.chat.completions.stream).toBeDefined();
    expect(client.responses).toBeDefined();
    expect(client.responses.create).toBeDefined();
    expect(client.responses.createStream).toBeDefined();
    expect(client.responses.stream).toBeDefined();
    expect(client.embeddings).toBeDefined();
    expect(client.embeddings.create).toBeDefined();
    expect(client.models).toBeDefined();
    expect(client.models.getInfo).toBeDefined();
    expect(client.images).toBeDefined();
    expect(client.images.generate).toBeDefined();
    expect(client.images.edit).toBeDefined();
    expect(client.audio).toBeDefined();
    expect(client.audio.transcriptions).toBeDefined();
    expect(client.audio.transcriptions.create).toBeDefined();
    expect(client.audio.transcriptions.stream).toBeDefined();
    expect(client.audio.translations).toBeDefined();
    expect(client.audio.translations.create).toBeDefined();
    expect(client.use).toBeDefined();
  });

  describe('chat.completions', () => {
    it('create tracks calls', async () => {
      const client = createMockAIGatewayClient();
      client.chat.completions.create.mockResolvedValue(createMockChatCompletion({ content: 'Hi' }));

      const result = (await client.chat.completions.create({ model: 'gpt-4.1-nano', messages: [] })) as ChatCompletion;
      expect(result.choices[0].message?.content).toBe('Hi');
      expect(client.chat.completions.create.callCount).toBe(1);
      expect(client.chat.completions.create.wasCalled).toBe(true);
    });

    it('stream returns mock stream result', async () => {
      const client = createMockAIGatewayClient();
      client.chat.completions.stream.mockReturnValue(createMockStreamTextResult({ text: ['Hello', ' world'] }));

      const result = client.chat.completions.stream({ model: 'm', messages: [] });
      expect(await result.text).toBe('Hello world');
    });

    it('mockRejectedValue works for error testing', async () => {
      const client = createMockAIGatewayClient();
      client.chat.completions.create.mockRejectedValue(new Error('Auth failed'));

      await expect(client.chat.completions.create({})).rejects.toThrow('Auth failed');
    });

    it('mockReturnValueOnce sequences work', async () => {
      const client = createMockAIGatewayClient();
      client.chat.completions.create
        .mockResolvedValueOnce(createMockChatCompletion({ content: 'first' }))
        .mockResolvedValueOnce(createMockChatCompletion({ content: 'second' }))
        .mockResolvedValue(createMockChatCompletion({ content: 'default' }));

      const r1 = (await client.chat.completions.create({})) as ChatCompletion;
      const r2 = (await client.chat.completions.create({})) as ChatCompletion;
      const r3 = (await client.chat.completions.create({})) as ChatCompletion;

      expect(r1.choices[0].message?.content).toBe('first');
      expect(r2.choices[0].message?.content).toBe('second');
      expect(r3.choices[0].message?.content).toBe('default');
    });
  });

  describe('responses', () => {
    it('create tracks calls', async () => {
      const client = createMockAIGatewayClient();
      client.responses.create.mockResolvedValue(createMockResponseObject({ content: 'Hello' }));

      const result = (await client.responses.create({ model: 'm', input: 'hi' })) as {
        output: Array<{ content: Array<{ text: string }> }>;
      };
      expect(result.output[0].content[0].text).toBe('Hello');
      expect(client.responses.create.callCount).toBe(1);
    });

    it('stream returns mock stream result', async () => {
      const client = createMockAIGatewayClient();
      client.responses.stream.mockReturnValue(createMockStreamResponseResult('response text'));

      const result = client.responses.stream({ model: 'm', input: 'hi' });
      expect(await result.text).toBe('response text');
    });
  });

  describe('embeddings', () => {
    it('create tracks calls with fixture', async () => {
      const client = createMockAIGatewayClient();
      client.embeddings.create.mockResolvedValue(createMockEmbeddingResponse({ embeddings: [[0.1, 0.2]] }));

      const result = (await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'hi',
      })) as CreateEmbeddingResponse;
      expect(result.data[0].embedding).toEqual([0.1, 0.2]);
    });
  });

  describe('models', () => {
    it('getInfo tracks calls with fixture', async () => {
      const client = createMockAIGatewayClient();
      client.models.getInfo.mockResolvedValue(createMockModelInfoResponse({ models: [{ name: 'gpt-4.1-nano' }] }));

      const result = (await client.models.getInfo()) as { data: Array<{ model_name: string }> };
      expect(result.data[0].model_name).toBe('gpt-4.1-nano');
    });
  });

  describe('images', () => {
    it('generate tracks calls with fixture', async () => {
      const client = createMockAIGatewayClient();
      client.images.generate.mockResolvedValue(createMockImageResponse({ urls: ['https://example.com/img.png'] }));

      const result = (await client.images.generate({ prompt: 'cat', model: 'dall-e-3' })) as CreateImageResponse;
      expect(result.data[0].url).toBe('https://example.com/img.png');
    });

    it('edit tracks calls', async () => {
      const client = createMockAIGatewayClient();
      client.images.edit.mockResolvedValue(createMockImageResponse());

      await client.images.edit({ image: new Blob(), prompt: 'add hat' });
      expect(client.images.edit.callCount).toBe(1);
    });
  });

  describe('audio', () => {
    it('transcriptions.create with fixture', async () => {
      const client = createMockAIGatewayClient();
      client.audio.transcriptions.create.mockResolvedValue(createMockTranscriptionResponse({ text: 'Hello world' }));

      const result = (await client.audio.transcriptions.create({
        file: new Blob(),
        model: 'whisper-1',
      })) as TranscriptionResponse;
      expect(result.text).toBe('Hello world');
    });

    it('translations.create with fixture', async () => {
      const client = createMockAIGatewayClient();
      client.audio.translations.create.mockResolvedValue(createMockTranslationResponse({ text: 'Translated' }));

      const result = (await client.audio.translations.create({
        file: new Blob(),
        model: 'whisper-1',
      })) as TranslationResponse;
      expect(result.text).toBe('Translated');
    });
  });

  describe('use (middleware)', () => {
    it('tracks middleware registrations', () => {
      const client = createMockAIGatewayClient();
      const mw = async (req: unknown, next: unknown) => (next as (r: unknown) => unknown)(req);
      client.use(mw);

      expect(client.use.callCount).toBe(1);
      expect(client.use.wasCalledWith(mw)).toBe(true);
    });
  });

  describe('mockClear vs mockReset', () => {
    it('mockClear keeps implementation', async () => {
      const client = createMockAIGatewayClient();
      client.chat.completions.create.mockResolvedValue(createMockChatCompletion({ content: 'kept' }));
      await client.chat.completions.create({});

      client.chat.completions.create.mockClear();
      expect(client.chat.completions.create.callCount).toBe(0);

      const result = (await client.chat.completions.create({})) as ChatCompletion;
      expect(result.choices[0].message?.content).toBe('kept');
    });
  });

  describe('mockResetAll', () => {
    it('resets all mock functions at once', async () => {
      const client = createMockAIGatewayClient();
      client.chat.completions.create.mockResolvedValue(createMockChatCompletion());
      client.responses.create.mockResolvedValue(createMockResponseObject());
      client.embeddings.create.mockResolvedValue(createMockEmbeddingResponse());

      await client.chat.completions.create({});
      await client.responses.create({});
      await client.embeddings.create({});

      expect(client.chat.completions.create.callCount).toBe(1);

      client.mockResetAll();

      expect(client.chat.completions.create.callCount).toBe(0);
      expect(client.responses.create.callCount).toBe(0);
      expect(client.embeddings.create.callCount).toBe(0);
      expect(client.chat.completions.create.wasCalled).toBe(false);
    });
  });
});
