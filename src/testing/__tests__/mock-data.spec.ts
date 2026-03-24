import { describe, it, expect } from 'vitest';
import {
  createMockChatCompletion,
  createMockResponseObject,
  createMockEmbeddingResponse,
  createMockImageResponse,
  createMockTranscriptionResponse,
  createMockTranslationResponse,
  createMockModelInfoResponse,
} from '../mock-data';

describe('createMockChatCompletion', () => {
  it('returns sensible defaults', () => {
    const c = createMockChatCompletion();
    expect(c.id).toBe('chatcmpl-mock');
    expect(c.object).toBe('chat.completion');
    expect(c.model).toBe('mock-model');
    expect(c.choices[0].message?.content).toBe('Mock response');
    expect(c.choices[0].finish_reason).toBe('stop');
  });

  it('applies custom options', () => {
    const c = createMockChatCompletion({ content: 'Hi!', model: 'gpt-4.1-nano', id: 'custom-id' });
    expect(c.id).toBe('custom-id');
    expect(c.model).toBe('gpt-4.1-nano');
    expect(c.choices[0].message?.content).toBe('Hi!');
  });

  it('accepts usage', () => {
    const usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
    const c = createMockChatCompletion({ usage });
    expect(c.usage).toEqual(usage);
  });
});

describe('createMockResponseObject', () => {
  it('returns sensible defaults', () => {
    const r = createMockResponseObject();
    expect(r.id).toBe('resp-mock');
    expect(r.object).toBe('response');
    expect(r.status).toBe('completed');
    expect(r.output[0].content[0].text).toBe('Mock response');
  });

  it('applies custom content and model', () => {
    const r = createMockResponseObject({ content: 'Custom', model: 'gpt-x' });
    expect(r.model).toBe('gpt-x');
    expect(r.output[0].content[0].text).toBe('Custom');
  });
});

describe('createMockEmbeddingResponse', () => {
  it('returns sensible defaults', () => {
    const r = createMockEmbeddingResponse();
    expect(r.object).toBe('list');
    expect(r.data).toHaveLength(1);
    expect(r.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
    expect(r.usage.prompt_tokens).toBe(5);
  });

  it('accepts custom embeddings', () => {
    const r = createMockEmbeddingResponse({
      embeddings: [
        [1, 2],
        [3, 4],
      ],
      model: 'text-embedding-custom',
    });
    expect(r.data).toHaveLength(2);
    expect(r.data[0].index).toBe(0);
    expect(r.data[1].index).toBe(1);
    expect(r.model).toBe('text-embedding-custom');
  });
});

describe('createMockImageResponse', () => {
  it('returns a default URL', () => {
    const r = createMockImageResponse();
    expect(r.data).toHaveLength(1);
    expect(r.data[0].url).toBe('https://mock.test/image.png');
  });

  it('accepts custom URLs', () => {
    const r = createMockImageResponse({ urls: ['https://a.com/1.png', 'https://a.com/2.png'] });
    expect(r.data).toHaveLength(2);
    expect(r.data[0].url).toBe('https://a.com/1.png');
  });

  it('accepts base64 data', () => {
    const r = createMockImageResponse({ b64: ['abc123'] });
    expect(r.data[0].b64_json).toBe('abc123');
  });
});

describe('createMockTranscriptionResponse', () => {
  it('returns sensible defaults', () => {
    const r = createMockTranscriptionResponse();
    expect(r.text).toBe('Mock transcription');
  });

  it('applies custom text', () => {
    const r = createMockTranscriptionResponse({ text: 'Hello', language: 'en', duration: 5.2 });
    expect(r.text).toBe('Hello');
    expect(r.language).toBe('en');
    expect(r.duration).toBe(5.2);
  });
});

describe('createMockTranslationResponse', () => {
  it('returns sensible defaults', () => {
    const r = createMockTranslationResponse();
    expect(r.text).toBe('Mock translation');
  });

  it('applies custom text', () => {
    const r = createMockTranslationResponse({ text: 'Translated' });
    expect(r.text).toBe('Translated');
  });
});

describe('createMockModelInfoResponse', () => {
  it('returns one default model', () => {
    const r = createMockModelInfoResponse();
    expect(r.data).toHaveLength(1);
    expect(r.data[0].model_name).toBe('mock-model');
    expect(r.data[0].model_info.mode).toBe('chat');
  });

  it('accepts custom models', () => {
    const r = createMockModelInfoResponse({
      models: [
        { name: 'openai/gpt-4.1-nano', mode: 'chat' },
        { name: 'text-embedding-3', mode: 'embedding' },
      ],
    });
    expect(r.data).toHaveLength(2);
    expect(r.data[0].model_name).toBe('openai/gpt-4.1-nano');
    expect(r.data[1].model_info.mode).toBe('embedding');
  });
});
