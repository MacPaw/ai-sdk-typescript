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

import type { ChatCompletionChunk, ChatCompletionUsage, ResponseStreamEvent, ResponseUsage } from '../types';
import { extractChatDelta, extractResponseDelta } from '../helpers';

interface Waiter<T> {
  resolve: (value: IteratorResult<T>) => void;
  reject: (reason: unknown) => void;
}

interface IteratorPosition {
  idx: number;
}

interface PumpState<T> {
  items: T[];
  trimOffset: number;
  activeIterators: Set<IteratorPosition>;
  pumpStarted: boolean;
  pumpDone: boolean;
  pumpError: unknown;
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
        const usage = extractUsage(item);
        if (usage) lastUsage = usage;
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
    ensureStarted: () => {
      startPump();
    },
  };
}

function wakeWaiters<T>(state: PumpState<T>, result: IteratorResult<T>): void {
  if (state.waiters.length === 0) return;
  const snapshot = state.waiters.splice(0);
  for (const waiter of snapshot) waiter.resolve(result);
}

function rejectWaiters<T>(state: PumpState<T>, error: unknown): void {
  if (state.waiters.length === 0) return;
  const snapshot = state.waiters.splice(0);
  for (const waiter of snapshot) waiter.reject(error);
}

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

function createChunkIterator<T>(state: PumpState<T>, ensureStarted: () => void): AsyncIterableIterator<T> {
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
    [Symbol.asyncIterator]() {
      return iter;
    },
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
    return(): Promise<IteratorResult<string>> {
      inner.return?.();
      return Promise.resolve({ value: undefined as unknown as string, done: true });
    },
    [Symbol.asyncIterator]() {
      return iter;
    },
  };
  return iter;
}

export interface StreamTextResult {
  readonly stream: AsyncIterable<ChatCompletionChunk>;
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
  const { state, textPromise, usagePromise, ensureStarted } = createPump(generator, extractChatDelta, extractChatUsage);

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

export interface StreamResponseResult {
  readonly stream: AsyncIterable<ResponseStreamEvent>;
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
