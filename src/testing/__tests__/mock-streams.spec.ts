import { describe, it, expect } from 'vitest';
import { createMockStreamTextResult, createMockStreamResponseResult } from '../mock-streams';

async function collectAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iter) result.push(item);
  return result;
}

describe('createMockStreamTextResult', () => {
  it('works with a simple string', async () => {
    const result = createMockStreamTextResult('Hello world');

    const text = await result.text;
    expect(text).toBe('Hello world');

    const deltas = await collectAsync(result.textStream);
    expect(deltas).toEqual(['Hello world']);

    const chunks = await collectAsync(result.stream);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].delta?.content).toBe('Hello world');
  });

  it('works with multiple text chunks', async () => {
    const result = createMockStreamTextResult({ text: ['Hello', ' ', 'world'] });

    const text = await result.text;
    expect(text).toBe('Hello world');

    const deltas = await collectAsync(result.textStream);
    expect(deltas).toEqual(['Hello', ' ', 'world']);

    const chunks = await collectAsync(result.stream);
    expect(chunks).toHaveLength(3);
    expect(chunks[2].choices[0].finish_reason).toBe('stop');
  });

  it('includes custom usage', async () => {
    const usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
    const result = createMockStreamTextResult({ text: 'Hi', usage });

    const resolvedUsage = await result.usage;
    expect(resolvedUsage).toEqual(usage);
  });

  it('abort() sets aborted flag', () => {
    const result = createMockStreamTextResult('test');
    expect(result.aborted).toBe(false);
    result.abort();
    expect(result.aborted).toBe(true);
  });
});

describe('createMockStreamResponseResult', () => {
  it('works with a simple string', async () => {
    const result = createMockStreamResponseResult('Hello');

    const text = await result.text;
    expect(text).toBe('Hello');

    const deltas = await collectAsync(result.textStream);
    expect(deltas).toEqual(['Hello']);

    const events = await collectAsync(result.stream);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].type).toBe('response.output_text.delta');
    expect(events[events.length - 1].type).toBe('response.completed');
  });

  it('works with multiple text chunks', async () => {
    const result = createMockStreamResponseResult({ text: ['Part1', 'Part2'] });

    const text = await result.text;
    expect(text).toBe('Part1Part2');

    const deltas = await collectAsync(result.textStream);
    expect(deltas).toEqual(['Part1', 'Part2']);

    const events = await collectAsync(result.stream);
    expect(events).toHaveLength(3); // 2 deltas + 1 completed
    expect(events[2].response!.output[0].content[0].text).toBe('Part1Part2');
  });

  it('includes custom usage', async () => {
    const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15 };
    const result = createMockStreamResponseResult({ text: 'x', usage });

    const resolvedUsage = await result.usage;
    expect(resolvedUsage).toEqual(usage);
  });

  it('abort() sets aborted flag', () => {
    const result = createMockStreamResponseResult('test');
    expect(result.aborted).toBe(false);
    result.abort();
    expect(result.aborted).toBe(true);
  });
});
