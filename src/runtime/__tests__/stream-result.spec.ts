import { describe, it, expect } from 'vitest';
import { createStreamTextResult, createStreamResponseResult } from '../index';
import type { ChatCompletionChunk, ChatCompletionUsage, ResponseStreamEvent, ResponseUsage } from '../../types';

function makeChatChunk(content: string, usage?: ChatCompletionUsage | null): ChatCompletionChunk {
  return {
    id: 'c1',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'm',
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
    ...(usage !== undefined ? { usage } : {}),
  };
}

async function* chatGen(chunks: string[]): AsyncGenerator<ChatCompletionChunk, void, undefined> {
  for (const c of chunks) {
    yield makeChatChunk(c);
  }
}

async function* chatGenWithUsage(
  chunks: string[],
  usage: ChatCompletionUsage,
): AsyncGenerator<ChatCompletionChunk, void, undefined> {
  for (const c of chunks) {
    yield makeChatChunk(c);
  }
  yield makeChatChunk('', usage);
}

async function* failingChatGen(chunksBeforeError: string[]): AsyncGenerator<ChatCompletionChunk, void, undefined> {
  for (const c of chunksBeforeError) {
    yield makeChatChunk(c);
  }
  throw new Error('stream exploded');
}

async function* responseGen(deltas: string[]): AsyncGenerator<ResponseStreamEvent, void, undefined> {
  for (const d of deltas) {
    yield { type: 'response.output_text.delta', delta: d };
  }
  yield { type: 'response.completed' };
}

async function* responseGenWithUsage(
  deltas: string[],
  usage: ResponseUsage,
): AsyncGenerator<ResponseStreamEvent, void, undefined> {
  for (const d of deltas) {
    yield { type: 'response.output_text.delta', delta: d };
  }
  yield {
    type: 'response.completed',
    response: {
      id: 'r1',
      object: 'response' as const,
      created_at: 1,
      status: 'completed' as const,
      model: 'm',
      output: [],
      usage,
    },
  };
}

async function* emptyGen(): AsyncGenerator<ChatCompletionChunk, void, undefined> {
  // yields nothing
}

describe('StreamTextResult', () => {
  it('textStream yields deltas and text resolves to full string', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(chatGen(['Hello', ' ', 'world']), ac);

    const deltas: string[] = [];
    for await (const d of result.textStream) {
      deltas.push(d);
    }
    expect(deltas).toEqual(['Hello', ' ', 'world']);
    expect(await result.text).toBe('Hello world');
  });

  it('stream yields raw chunks', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(chatGen(['A', 'B']), ac);

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of result.stream) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(2);
    expect(chunks[0].choices[0].delta?.content).toBe('A');
    expect(chunks[1].choices[0].delta?.content).toBe('B');
  });

  it('text resolves even without iterating stream or textStream', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(chatGen(['Hi', '!']), ac);

    const text = await result.text;
    expect(text).toBe('Hi!');
  });

  it('rejects late stream consumption after aggregated text path has already started', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(chatGen(['Hi', '!']), ac);

    await expect(result.text).resolves.toBe('Hi!');

    expect(() => result.textStream[Symbol.asyncIterator]()).toThrow('Stream iteration must start before aggregated consumption begins');
  });

  it('propagates generator error to text promise', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(failingChatGen(['OK']), ac);

    await expect(result.text).rejects.toThrow('stream exploded');
  });

  it('propagates generator error to stream consumer', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(failingChatGen(['OK']), ac);

    const chunks: string[] = [];
    await expect(async () => {
      for await (const d of result.textStream) {
        chunks.push(d);
      }
    }).rejects.toThrow('stream exploded');
    expect(chunks).toEqual(['OK']);
  });

  it('abort() cancels the underlying controller', () => {
    const ac = new AbortController();
    const result = createStreamTextResult(chatGen([]), ac);
    expect(ac.signal.aborted).toBe(false);
    result.abort();
    expect(ac.signal.aborted).toBe(true);
  });

  it('usage resolves with token usage from the final chunk', async () => {
    const ac = new AbortController();
    const usage: ChatCompletionUsage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
    const result = createStreamTextResult(chatGenWithUsage(['Hi'], usage), ac);

    const resolved = await result.usage;
    expect(resolved).toEqual(usage);
    expect(await result.text).toBe('Hi');
  });

  it('usage resolves to undefined when no usage in chunks', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(chatGen(['Hi']), ac);

    expect(await result.usage).toBeUndefined();
  });

  it('handles empty stream gracefully', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(emptyGen(), ac);

    expect(await result.text).toBe('');
    expect(await result.usage).toBeUndefined();

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of result.stream) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(0);
  });

  it('usage rejects on stream error', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(failingChatGen(['x']), ac);

    await expect(result.usage).rejects.toThrow('stream exploded');
  });

  it('trims consumed items from memory (GC)', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(chatGen(['A', 'B', 'C', 'D', 'E']), ac);

    const deltas: string[] = [];
    for await (const d of result.textStream) {
      deltas.push(d);
    }
    expect(deltas).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(await result.text).toBe('ABCDE');
  });

  it('cleans up iterator position on early break', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(chatGen(['A', 'B', 'C', 'D']), ac);

    const deltas: string[] = [];
    for await (const d of result.textStream) {
      deltas.push(d);
      if (d === 'B') break;
    }
    expect(deltas).toEqual(['A', 'B']);
    expect(await result.text).toBe('ABCD');
  });

  it('allows only one async iterator consumer across stream and textStream', async () => {
    const ac = new AbortController();
    const result = createStreamTextResult(chatGen(['A', 'B', 'C']), ac);

    const rawConsumer = (async () => {
      const arr: ChatCompletionChunk[] = [];
      for await (const c of result.stream) arr.push(c);
      return arr;
    })();

    await expect(async () => {
      for await (const d of result.textStream) {
        void d;
      }
    }).rejects.toThrow('exactly one async iterator consumer');

    const chunks = await rawConsumer;
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.choices[0].delta?.content)).toEqual(['A', 'B', 'C']);
    expect(await result.text).toBe('ABC');
  });
});

describe('StreamResponseResult', () => {
  it('textStream yields deltas and text resolves to full string', async () => {
    const ac = new AbortController();
    const result = createStreamResponseResult(responseGen(['Hello', ' world']), ac);

    const deltas: string[] = [];
    for await (const d of result.textStream) {
      deltas.push(d);
    }
    expect(deltas.filter((d) => d !== '')).toEqual(['Hello', ' world']);
    expect(await result.text).toBe('Hello world');
  });

  it('text resolves without iteration', async () => {
    const ac = new AbortController();
    const result = createStreamResponseResult(responseGen(['A', 'B']), ac);

    expect(await result.text).toBe('AB');
  });

  it('usage resolves with token usage from completed event', async () => {
    const ac = new AbortController();
    const usage: ResponseUsage = { input_tokens: 20, output_tokens: 10, total_tokens: 30 };
    const result = createStreamResponseResult(responseGenWithUsage(['Hi'], usage), ac);

    expect(await result.usage).toEqual(usage);
    expect(await result.text).toBe('Hi');
  });

  it('usage resolves to undefined when no response.usage in events', async () => {
    const ac = new AbortController();
    const result = createStreamResponseResult(responseGen(['Hi']), ac);

    expect(await result.usage).toBeUndefined();
  });
});
