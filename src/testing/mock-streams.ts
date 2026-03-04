import type { StreamTextResult } from '../core/stream-result';
import type { StreamResponseResult } from '../core/stream-result';
import type {
  ChatCompletionChunk,
  ChatCompletionUsage,
  ResponseStreamEvent,
  ResponseUsage,
} from '../core/types';

/** `StreamTextResult` extended with an observable `aborted` flag for test assertions. */
export type MockStreamTextResult = StreamTextResult & { aborted: boolean };

/** `StreamResponseResult` extended with an observable `aborted` flag for test assertions. */
export type MockStreamResponseResult = StreamResponseResult & { aborted: boolean };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function* toAsyncIterable<T>(items: T[]): AsyncGenerator<T, void, undefined> {
  for (const item of items) {
    yield item;
  }
}

function asyncIterableFrom<T>(items: T[]): AsyncIterable<T> {
  return { [Symbol.asyncIterator]: () => toAsyncIterable(items) };
}

// ---------------------------------------------------------------------------
// Chat stream mock
// ---------------------------------------------------------------------------

export interface MockStreamTextOptions {
  /** Text chunks to yield. If a single string, it's yielded as one chunk. */
  text: string | string[];
  /** Model name for the generated chunks. Defaults to `"mock-model"`. */
  model?: string;
  /** Custom usage stats attached to the last chunk. */
  usage?: ChatCompletionUsage;
}

function buildChatChunks(opts: MockStreamTextOptions): ChatCompletionChunk[] {
  const deltas = typeof opts.text === 'string' ? [opts.text] : opts.text;
  const model = opts.model ?? 'mock-model';

  return deltas.map((content, i) => ({
    id: `chatcmpl-mock-${i}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { role: 'assistant', content },
        finish_reason: i === deltas.length - 1 ? 'stop' : null,
      },
    ],
    usage: i === deltas.length - 1 ? (opts.usage ?? null) : null,
  }));
}

/**
 * Create a mock `StreamTextResult` for testing chat streaming.
 *
 * @example
 * ```ts
 * client.chat.completions.stream.mockReturnValue(
 *   createMockStreamTextResult({ text: ['Hello', ' world'] }),
 * );
 * ```
 */
export function createMockStreamTextResult(opts: MockStreamTextOptions | string): MockStreamTextResult {
  const resolved = typeof opts === 'string' ? { text: opts } : opts;
  const chunks = buildChatChunks(resolved);
  const fullText = (typeof resolved.text === 'string' ? [resolved.text] : resolved.text).join('');

  const result = {
    stream: asyncIterableFrom(chunks),
    textStream: asyncIterableFrom(
      typeof resolved.text === 'string' ? [resolved.text] : resolved.text,
    ),
    text: Promise.resolve(fullText),
    usage: Promise.resolve(resolved.usage),
    /** Whether `abort()` was called. Useful for asserting cancellation in tests. */
    aborted: false,
    abort() {
      result.aborted = true;
    },
  };
  return result;
}

// ---------------------------------------------------------------------------
// Responses stream mock
// ---------------------------------------------------------------------------

export interface MockStreamResponseOptions {
  /** Text chunks to yield. If a single string, it's yielded as one chunk. */
  text: string | string[];
  /** Model name. Defaults to `"mock-model"`. */
  model?: string;
  /** Custom usage stats. */
  usage?: ResponseUsage;
}

function buildResponseEvents(opts: MockStreamResponseOptions): ResponseStreamEvent[] {
  const deltas = typeof opts.text === 'string' ? [opts.text] : opts.text;
  const model = opts.model ?? 'mock-model';
  const fullText = deltas.join('');

  const events: ResponseStreamEvent[] = deltas.map((delta) => ({
    type: 'response.output_text.delta',
    delta,
  }));

  events.push({
    type: 'response.completed',
    response: {
      id: 'resp-mock',
      object: 'response' as const,
      created_at: Math.floor(Date.now() / 1000),
      status: 'completed' as const,
      model,
      output: [
        {
          type: 'message' as const,
          id: 'msg-mock',
          role: 'assistant' as const,
          status: 'completed' as const,
          content: [{ type: 'output_text' as const, text: fullText }],
        },
      ],
      usage: opts.usage,
    },
  });

  return events;
}

/**
 * Create a mock `StreamResponseResult` for testing response streaming.
 *
 * @example
 * ```ts
 * client.responses.stream.mockReturnValue(
 *   createMockStreamResponseResult({ text: ['Hello', ' world'] }),
 * );
 * ```
 */
export function createMockStreamResponseResult(
  opts: MockStreamResponseOptions | string,
): MockStreamResponseResult {
  const resolved = typeof opts === 'string' ? { text: opts } : opts;
  const events = buildResponseEvents(resolved);
  const fullText = (typeof resolved.text === 'string' ? [resolved.text] : resolved.text).join('');

  const result = {
    stream: asyncIterableFrom(events),
    textStream: asyncIterableFrom(
      typeof resolved.text === 'string' ? [resolved.text] : resolved.text,
    ),
    text: Promise.resolve(fullText),
    usage: Promise.resolve(resolved.usage),
    /** Whether `abort()` was called. Useful for asserting cancellation in tests. */
    aborted: false,
    abort() {
      result.aborted = true;
    },
  };
  return result;
}
