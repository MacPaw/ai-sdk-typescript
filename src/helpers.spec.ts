import { describe, it, expect } from 'vitest';
import { extractChatDelta, collectChatStream, extractResponseDelta, collectResponseStream } from './helpers';
import type { ChatCompletionChunk, ResponseStreamEvent } from './core/types';

describe('extractChatDelta', () => {
  it('extracts content from delta', () => {
    const chunk: ChatCompletionChunk = {
      id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'm',
      choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
    };
    expect(extractChatDelta(chunk)).toBe('Hello');
  });

  it('returns empty string when no content', () => {
    const chunk: ChatCompletionChunk = {
      id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'm',
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
    };
    expect(extractChatDelta(chunk)).toBe('');
  });

  it('returns empty string when choices is empty', () => {
    const chunk: ChatCompletionChunk = {
      id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'm',
      choices: [],
    };
    expect(extractChatDelta(chunk)).toBe('');
  });
});

describe('collectChatStream', () => {
  it('collects full text from stream', async () => {
    async function* gen(): AsyncGenerator<ChatCompletionChunk> {
      yield {
        id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'm',
        choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
      };
      yield {
        id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'm',
        choices: [{ index: 0, delta: { content: ' world' }, finish_reason: null }],
      };
    }
    const text = await collectChatStream(gen());
    expect(text).toBe('Hello world');
  });
});

describe('extractResponseDelta', () => {
  it('extracts delta from output_text.delta event', () => {
    const event: ResponseStreamEvent = { type: 'response.output_text.delta', delta: 'Hi' };
    expect(extractResponseDelta(event)).toBe('Hi');
  });

  it('returns empty string for non-delta events', () => {
    const event: ResponseStreamEvent = { type: 'response.created' };
    expect(extractResponseDelta(event)).toBe('');
  });
});

describe('collectResponseStream', () => {
  it('collects full text from stream', async () => {
    async function* gen(): AsyncGenerator<ResponseStreamEvent> {
      yield { type: 'response.created' };
      yield { type: 'response.output_text.delta', delta: 'Hello' };
      yield { type: 'response.output_text.delta', delta: ' world' };
      yield { type: 'response.completed' };
    }
    const text = await collectResponseStream(gen());
    expect(text).toBe('Hello world');
  });
});
