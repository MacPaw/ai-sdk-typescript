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
//
// Architecture: a single background pump reads the generator and appends
// chunks to `items[]`. Multiple independent iterators (`stream`, `textStream`)
// consume from the same `items[]` array using their own absolute cursor.
//
// When a consumer is ahead of the pump (all buffered items read), it parks
// a waiter (resolve/reject pair) in the `waiters` queue. The pump wakes ALL
// parked waiters as soon as the next chunk arrives, so parallel consumers
// (e.g. `stream` and `textStream` consumed simultaneously) never deadlock.
//
// GC: items that ALL active iterators have consumed are trimmed from the
// front of `items[]`. `trimOffset` tracks how many items have been removed
// so that absolute cursor positions remain valid. This bounds memory usage
// for long-running streams (hours of audio, extended chats).
// ---------------------------------------------------------------------------

interface Waiter<T> {
  resolve: (value: IteratorResult<T>) => void;
  reject: (reason: unknown) => void;
}

/** Tracks absolute read position of a single iterator. */
interface IteratorPosition {
  idx: number;
}

interface PumpState<T> {
  items: T[];
  /** Number of items trimmed from the front — absolute index = arrayIndex + trimOffset. */
  trimOffset: number;
  /** All live iterators; used to compute GC watermark. */
  activeIterators: Set<IteratorPosition>;
  pumpStarted: boolean;
  pumpDone: boolean;
  pumpError: unknown;
  /** Queue of consumers waiting for the next chunk (supports multiple parallel readers). */
  waiters: Waiter<T>[];
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
    trimOffset: 0,
    activeIterators: new Set(),
    pumpStarted: false,
    pumpDone: false,
    pumpError: undefined,
    waiters: [],
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
        wakeWaiters(state, { value: item, done: false });
      }
      state.pumpDone = true;
      state.textResolve(fullText);
      usageResolve!(lastUsage);
      wakeWaiters(state, { value: undefined as unknown as T, done: true });
    } catch (err) {
      state.pumpDone = true;
      state.pumpError = err;
      state.textReject(err);
      usageReject!(err);
      rejectWaiters(state, err);
    }
  }

  return {
    state,
    textPromise,
    usagePromise,
    ensureStarted: () => { startPump(); },
  };
}

/** Wake all parked waiters with the given result. */
function wakeWaiters<T>(state: PumpState<T>, result: IteratorResult<T>): void {
  if (state.waiters.length === 0) return;
  const snapshot = state.waiters.splice(0);
  for (const w of snapshot) w.resolve(result);
}

/** Reject all parked waiters with the given error. */
function rejectWaiters<T>(state: PumpState<T>, error: unknown): void {
  if (state.waiters.length === 0) return;
  const snapshot = state.waiters.splice(0);
  for (const w of snapshot) w.reject(error);
}

/**
 * Trim items that all active iterators have already consumed.
 * Safe to call after every next()/return() — it's a no-op when nothing can be freed.
 */
function maybeTrim<T>(state: PumpState<T>): void {
  if (state.activeIterators.size === 0) {
    if (state.pumpDone && state.items.length > 0) {
      state.trimOffset += state.items.length;
      state.items.length = 0;
    }
    return;
  }
  let minIdx = Infinity;
  for (const pos of state.activeIterators) {
    if (pos.idx < minIdx) minIdx = pos.idx;
  }
  const trimCount = minIdx - state.trimOffset;
  if (trimCount > 0) {
    state.items.splice(0, trimCount);
    state.trimOffset += trimCount;
  }
}

/**
 * Create an independent async iterator over the shared `state.items[]`.
 * Each call returns a fresh iterator with its own cursor, so
 * `stream` and `textStream` can be consumed independently or in parallel.
 *
 * Implements `return()` for proper cleanup: when a `for await` loop breaks
 * early, the iterator is unregistered so its position no longer blocks GC.
 */
function createChunkIterator<T>(
  state: PumpState<T>,
  ensureStarted: () => void,
): AsyncIterableIterator<T> {
  const pos: IteratorPosition = { idx: state.trimOffset };
  state.activeIterators.add(pos);
  ensureStarted();

  function finish(): void {
    state.activeIterators.delete(pos);
    maybeTrim(state);
  }

  const iter: AsyncIterableIterator<T> = {
    next(): Promise<IteratorResult<T>> {
      const arrayIdx = pos.idx - state.trimOffset;
      if (arrayIdx >= 0 && arrayIdx < state.items.length) {
        const value = state.items[arrayIdx];
        pos.idx++;
        maybeTrim(state);
        return Promise.resolve({ value, done: false });
      }
      if (state.pumpDone) {
        finish();
        if (state.pumpError) return Promise.reject(state.pumpError);
        return Promise.resolve({ value: undefined as unknown as T, done: true });
      }
      return new Promise<IteratorResult<T>>((resolve, reject) => {
        state.waiters.push({
          resolve: (result) => {
            if (!result.done) {
              pos.idx = state.trimOffset + state.items.length;
              maybeTrim(state);
            } else {
              finish();
            }
            resolve(result);
          },
          reject: (err) => {
            finish();
            reject(err);
          },
        });
      });
    },
    return(): Promise<IteratorResult<T>> {
      finish();
      return Promise.resolve({ value: undefined as unknown as T, done: true });
    },
    [Symbol.asyncIterator]() { return iter; },
  };
  return iter;
}

/** Like `createChunkIterator` but yields only the text delta from each chunk. */
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
    return(): Promise<IteratorResult<string>> {
      inner.return?.();
      return Promise.resolve({ value: undefined as unknown as string, done: true });
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
  /**
   * Promise that resolves to token usage from the final chunk.
   * The SDK automatically sends `stream_options: { include_usage: true }` when you
   * use `.stream()`. If you use `create({ stream: true })` directly, you must pass
   * `stream_options` yourself or this will resolve to `undefined`.
   */
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
