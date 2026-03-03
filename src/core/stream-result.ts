/**
 * Rich stream result objects inspired by Vercel AI SDK.
 *
 * Instead of returning a raw AsyncGenerator, `.stream()` methods return a result
 * object that offers multiple consumption patterns:
 *   - `stream`     — raw AsyncIterable of typed chunks (for `for await`)
 *   - `textStream` — AsyncIterable of just the text deltas
 *   - `text`       — Promise that resolves to the full concatenated text
 *   - `abort()`    — cancel the underlying request
 */

import type { ChatCompletionChunk, ChatCompletionUsage, ResponseStreamEvent, ResponseUsage } from './types';
import { extractChatDelta, extractResponseDelta } from '../helpers';

// ---------------------------------------------------------------------------
// Shared pump logic
// ---------------------------------------------------------------------------

interface PumpState<T> {
  items: T[];
  buffer: T[];
  pumpStarted: boolean;
  pumpDone: boolean;
  pumpError: unknown;
  pendingResolve: ((value: IteratorResult<T>) => void) | null;
  pendingReject: ((reason: unknown) => void) | null;
  textResolve: (value: string) => void;
  textReject: (reason: unknown) => void;
}

interface PumpResult<T, U> {
  state: PumpState<T>;
  textPromise: Promise<string>;
  usagePromise: Promise<U | undefined>;
  ensureStarted: () => void;
}

function createPump<T, U>(
  generator: AsyncGenerator<T, void, undefined>,
  extractDelta: (item: T) => string,
  extractUsage: (item: T) => U | undefined,
): PumpResult<T, U> {
  const state: PumpState<T> = {
    items: [],
    buffer: [],
    pumpStarted: false,
    pumpDone: false,
    pumpError: undefined,
    pendingResolve: null,
    pendingReject: null,
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

  async function startPump() {
    if (state.pumpStarted) return;
    state.pumpStarted = true;
    let fullText = '';
    let lastUsage: U | undefined;
    try {
      for await (const item of generator) {
        state.items.push(item);
        fullText += extractDelta(item);
        const u = extractUsage(item);
        if (u) lastUsage = u;
        if (state.pendingResolve) {
          const resolve = state.pendingResolve;
          state.pendingResolve = null;
          state.pendingReject = null;
          resolve({ value: item, done: false });
        } else {
          state.buffer.push(item);
        }
      }
      state.pumpDone = true;
      state.textResolve(fullText);
      usageResolve!(lastUsage);
      if (state.pendingResolve) {
        const resolve = state.pendingResolve;
        state.pendingResolve = null;
        state.pendingReject = null;
        resolve({ value: undefined as unknown as T, done: true });
      }
    } catch (err) {
      state.pumpDone = true;
      state.pumpError = err;
      state.textReject(err);
      usageReject!(err);
      if (state.pendingReject) {
        const reject = state.pendingReject;
        state.pendingResolve = null;
        state.pendingReject = null;
        reject(err);
      }
    }
  }

  return {
    state,
    textPromise,
    usagePromise,
    ensureStarted: () => { startPump(); },
  };
}

function createChunkIterator<T>(
  state: PumpState<T>,
  ensureStarted: () => void,
): AsyncIterableIterator<T> {
  let idx = 0;
  ensureStarted();
  const iter: AsyncIterableIterator<T> = {
    next(): Promise<IteratorResult<T>> {
      if (idx < state.items.length) {
        return Promise.resolve({ value: state.items[idx++], done: false });
      }
      if (state.buffer.length > 0) {
        state.buffer.shift();
        idx = state.items.length;
        return Promise.resolve({ value: state.items[idx - 1], done: false });
      }
      if (state.pumpDone) {
        if (state.pumpError) return Promise.reject(state.pumpError);
        return Promise.resolve({ value: undefined as unknown as T, done: true });
      }
      return new Promise<IteratorResult<T>>((resolve, reject) => {
        state.pendingResolve = (result) => {
          if (!result.done) idx = state.items.length;
          resolve(result);
        };
        state.pendingReject = reject;
      });
    },
    [Symbol.asyncIterator]() { return iter; },
  };
  return iter;
}

function createDeltaIterator<T>(
  state: PumpState<T>,
  ensureStarted: () => void,
  extractDelta: (item: T) => string,
): AsyncIterableIterator<string> {
  const inner = createChunkIterator(state, ensureStarted);
  const iter: AsyncIterableIterator<string> = {
    async next(): Promise<IteratorResult<string>> {
      const result = await inner.next();
      if (result.done) return { value: undefined as unknown as string, done: true };
      return { value: extractDelta(result.value), done: false };
    },
    [Symbol.asyncIterator]() { return iter; },
  };
  return iter;
}

// ---------------------------------------------------------------------------
// Chat completions
// ---------------------------------------------------------------------------

export interface StreamTextResult {
  /** Raw async iterable of ChatCompletionChunk objects. */
  readonly stream: AsyncIterable<ChatCompletionChunk>;
  /** Async iterable that yields only the text delta strings. */
  readonly textStream: AsyncIterable<string>;
  /** Promise that resolves to the full concatenated text once the stream ends. */
  readonly text: Promise<string>;
  /** Promise that resolves to token usage from the final chunk (if the API includes it). */
  readonly usage: Promise<ChatCompletionUsage | undefined>;
  /** Cancel the underlying request. */
  abort(): void;
}

function extractChatUsage(chunk: ChatCompletionChunk): ChatCompletionUsage | undefined {
  return chunk.usage ?? undefined;
}

export function createStreamTextResult(
  generator: AsyncGenerator<ChatCompletionChunk, void, undefined>,
  abortController: AbortController,
): StreamTextResult {
  const { state, textPromise, usagePromise, ensureStarted } = createPump(
    generator,
    extractChatDelta,
    extractChatUsage,
  );

  ensureStarted();

  const stream: AsyncIterable<ChatCompletionChunk> = {
    [Symbol.asyncIterator]() {
      return createChunkIterator(state, ensureStarted);
    },
  };

  const textStream: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      return createDeltaIterator(state, ensureStarted, extractChatDelta);
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

// ---------------------------------------------------------------------------
// Responses API
// ---------------------------------------------------------------------------

export interface StreamResponseResult {
  /** Raw async iterable of ResponseStreamEvent objects. */
  readonly stream: AsyncIterable<ResponseStreamEvent>;
  /** Async iterable that yields only the text delta strings. */
  readonly textStream: AsyncIterable<string>;
  /** Promise that resolves to the full concatenated text once the stream ends. */
  readonly text: Promise<string>;
  /** Promise that resolves to token usage from the final response event (if available). */
  readonly usage: Promise<ResponseUsage | undefined>;
  /** Cancel the underlying request. */
  abort(): void;
}

function extractResponseUsage(event: ResponseStreamEvent): ResponseUsage | undefined {
  return event.response?.usage ?? undefined;
}

export function createStreamResponseResult(
  generator: AsyncGenerator<ResponseStreamEvent, void, undefined>,
  abortController: AbortController,
): StreamResponseResult {
  const { state, textPromise, usagePromise, ensureStarted } = createPump(
    generator,
    extractResponseDelta,
    extractResponseUsage,
  );

  ensureStarted();

  const stream: AsyncIterable<ResponseStreamEvent> = {
    [Symbol.asyncIterator]() {
      return createChunkIterator(state, ensureStarted);
    },
  };

  const textStream: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      return createDeltaIterator(state, ensureStarted, extractResponseDelta);
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
