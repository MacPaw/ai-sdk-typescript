/**
 * Rich stream result objects inspired by Vercel AI SDK.
 *
 * Instead of returning a raw AsyncGenerator, `.stream()` methods return a result
 * object that offers:
 *   - `stream` or `textStream` — choose one async iterator view for the stream
 *   - `text`                   — Promise that resolves to the full concatenated text
 *   - `abort()`                — cancel the underlying request
 *
 * The underlying network stream is single-consumer by design. Supporting
 * multi-subscribe would add substantial buffering/coordination complexity,
 * while the SDK only needs one live iterator plus derived `text`/`usage`
 * promises that resolve even when the caller never iterates the stream.
 */

import type { ChatCompletionChunk, ChatCompletionUsage, ResponseStreamEvent, ResponseUsage } from '../types';
import { extractChatDelta, extractResponseDelta } from '../helpers';

interface Waiter {
  resolve: () => void;
  reject: (reason: unknown) => void;
}

type StreamConsumerKind = 'stream' | 'textStream';

interface StreamState<T> {
  items: T[];
  done: boolean;
  error: unknown;
  consumerKind?: StreamConsumerKind;
  consumerClosed: boolean;
  waiter?: Waiter;
  textResolve: (value: string) => void;
  textReject: (reason: unknown) => void;
}

interface StreamResultState<T, U> {
  state: StreamState<T>;
  textPromise: Promise<string>;
  usagePromise: Promise<U | undefined>;
}

const SINGLE_CONSUMER_ERROR =
  'Stream results support exactly one async iterator consumer. Use either `stream` or `textStream`, and use `text` for the final concatenated output.';

function createSingleConsumerState<T, U>(
  generator: AsyncGenerator<T, void, undefined>,
  extractDelta: (item: T) => string,
  extractUsage: (item: T) => U | undefined,
): StreamResultState<T, U> {
  const state: StreamState<T> = {
    items: [],
    done: false,
    error: undefined,
    consumerKind: undefined,
    consumerClosed: false,
    waiter: undefined,
    textResolve: undefined!,
    textReject: undefined!,
  };

  const textPromise = new Promise<string>((resolve, reject) => {
    state.textResolve = resolve;
    state.textReject = reject;
  });

  let usageResolve: (value: U | undefined) => void;
  let usageReject: (reason: unknown) => void;
  const usagePromise = new Promise<U | undefined>((resolve, reject) => {
    usageResolve = resolve;
    usageReject = reject;
  });

  textPromise.catch(() => {});
  usagePromise.catch(() => {});

  async function startPump(): Promise<void> {
    let fullText = '';
    let lastUsage: U | undefined;

    try {
      for await (const item of generator) {
        fullText += extractDelta(item);
        const usage = extractUsage(item);
        if (usage !== undefined) lastUsage = usage;

        if (!state.consumerClosed) {
          state.items.push(item);
          state.waiter?.resolve();
          state.waiter = undefined;
        }
      }
      state.done = true;
      state.textResolve(fullText);
      usageResolve!(lastUsage);
      state.waiter?.resolve();
      state.waiter = undefined;
    } catch (err) {
      state.done = true;
      state.error = err;
      state.items.length = 0;
      state.textReject(err);
      usageReject!(err);
      state.waiter?.reject(err);
      state.waiter = undefined;
    }
  }

  void startPump();

  return {
    state,
    textPromise,
    usagePromise,
  };
}

function claimConsumer<T>(state: StreamState<T>, kind: StreamConsumerKind): void {
  if (state.consumerKind !== undefined) {
    throw new Error(SINGLE_CONSUMER_ERROR);
  }
  state.consumerKind = kind;
}

function createSingleConsumerIterator<T, R>(
  state: StreamState<T>,
  mapValue: (item: T) => R,
): AsyncIterableIterator<R> {
  async function next(): Promise<IteratorResult<R>> {
    if (state.items.length > 0) {
      const value = state.items.shift()!;
      return { value: mapValue(value), done: false };
    }

    if (state.done) {
      if (state.error) throw state.error;
      return { value: undefined as unknown as R, done: true };
    }

    await new Promise<void>((resolve, reject) => {
      state.waiter = { resolve, reject };
    });

    return next();
  }

  const iter: AsyncIterableIterator<R> = {
    next,
    return(): Promise<IteratorResult<R>> {
      state.consumerClosed = true;
      state.items.length = 0;
      return Promise.resolve({ value: undefined as unknown as R, done: true });
    },
    [Symbol.asyncIterator]() {
      return iter;
    },
  };

  return iter;
}

export interface StreamTextResult {
  /** Raw chunk view. Use either this or `textStream`, not both. */
  readonly stream: AsyncIterable<ChatCompletionChunk>;
  /** Text-delta view. Use either this or `stream`, not both. */
  readonly textStream: AsyncIterable<string>;
  readonly text: Promise<string>;
  readonly usage: Promise<ChatCompletionUsage | undefined>;
  abort(): void;
}

function extractChatUsage(chunk: ChatCompletionChunk): ChatCompletionUsage | undefined {
  return chunk.usage ?? undefined;
}

export function createStreamTextResult(
  generator: AsyncGenerator<ChatCompletionChunk, void, undefined>,
  abortController: AbortController,
): StreamTextResult {
  const { state, textPromise, usagePromise } = createSingleConsumerState(generator, extractChatDelta, extractChatUsage);

  const stream: AsyncIterable<ChatCompletionChunk> = {
    [Symbol.asyncIterator]() {
      claimConsumer(state, 'stream');
      return createSingleConsumerIterator(state, (chunk) => chunk);
    },
  };

  const textStream: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      claimConsumer(state, 'textStream');
      return createSingleConsumerIterator(state, extractChatDelta);
    },
  };

  return {
    stream,
    textStream,
    text: textPromise,
    usage: usagePromise,
    abort() {
      abortController.abort();
    },
  };
}

export interface StreamResponseResult {
  /** Raw event view. Use either this or `textStream`, not both. */
  readonly stream: AsyncIterable<ResponseStreamEvent>;
  /** Text-delta view. Use either this or `stream`, not both. */
  readonly textStream: AsyncIterable<string>;
  readonly text: Promise<string>;
  readonly usage: Promise<ResponseUsage | undefined>;
  abort(): void;
}

function extractResponseUsage(event: ResponseStreamEvent): ResponseUsage | undefined {
  return event.response?.usage ?? undefined;
}

export function createStreamResponseResult(
  generator: AsyncGenerator<ResponseStreamEvent, void, undefined>,
  abortController: AbortController,
): StreamResponseResult {
  const { state, textPromise, usagePromise } = createSingleConsumerState(
    generator,
    extractResponseDelta,
    extractResponseUsage,
  );

  const stream: AsyncIterable<ResponseStreamEvent> = {
    [Symbol.asyncIterator]() {
      claimConsumer(state, 'stream');
      return createSingleConsumerIterator(state, (event) => event);
    },
  };

  const textStream: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      claimConsumer(state, 'textStream');
      return createSingleConsumerIterator(state, extractResponseDelta);
    },
  };

  return {
    stream,
    textStream,
    text: textPromise,
    usage: usagePromise,
    abort() {
      abortController.abort();
    },
  };
}
