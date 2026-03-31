import { describe, it, expect } from 'vitest';
import { extractResponseDelta, collectResponseStream } from '../helpers';
import type { ResponseStreamEvent } from '../types';

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
