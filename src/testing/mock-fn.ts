/**
 * Minimal framework-agnostic mock function.
 * Works without vitest/jest — users get call tracking and return value control out of the box.
 */

import { isDeepStrictEqual } from 'node:util';

function isBinaryLike(value: unknown): value is Blob | File {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (typeof File !== 'undefined' && value instanceof File) return true;
  return false;
}

function areEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (isBinaryLike(left) || isBinaryLike(right)) return false;

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => areEqual(item, right[index]));
  }

  if (
    left != null &&
    right != null &&
    typeof left === 'object' &&
    typeof right === 'object' &&
    Object.getPrototypeOf(left) === Object.prototype &&
    Object.getPrototypeOf(right) === Object.prototype
  ) {
    const leftEntries = Object.entries(left as Record<string, unknown>);
    const rightEntries = Object.entries(right as Record<string, unknown>);

    return (
      leftEntries.length === rightEntries.length &&
      leftEntries.every(
        ([key, value]) =>
          key in (right as Record<string, unknown>) && areEqual(value, (right as Record<string, unknown>)[key]),
      )
    );
  }

  return isDeepStrictEqual(left, right);
}

export interface MockFn<TReturn = unknown> {
  (...args: unknown[]): TReturn;
  /** All recorded calls (each entry is the arguments array). */
  readonly calls: unknown[][];
  /** Number of times the function was called. */
  readonly callCount: number;
  /** Arguments of the most recent call, or undefined if never called. */
  readonly lastCall: unknown[] | undefined;
  /** `true` if the function was called at least once. */
  readonly wasCalled: boolean;

  /** Set a fixed return value for all future calls. */
  mockReturnValue(value: TReturn): MockFn<TReturn>;
  /** Set a return value for the *next* call only, then fall back to the default. */
  mockReturnValueOnce(value: TReturn): MockFn<TReturn>;
  /** Set a fixed resolved value (wraps in Promise). */
  mockResolvedValue(value: unknown): MockFn<TReturn>;
  /** Set a resolved value for the *next* call only. */
  mockResolvedValueOnce(value: unknown): MockFn<TReturn>;
  /** Set a fixed rejected value (wraps in Promise.reject). */
  mockRejectedValue(error: unknown): MockFn<TReturn>;
  /** Set a rejected value for the *next* call only. */
  mockRejectedValueOnce(error: unknown): MockFn<TReturn>;
  /** Provide a custom implementation. */
  mockImplementation(fn: (...args: unknown[]) => TReturn): MockFn<TReturn>;
  /** Provide a custom implementation for the *next* call only. */
  mockImplementationOnce(fn: (...args: unknown[]) => TReturn): MockFn<TReturn>;
  /** Clear call history but keep the current implementation. */
  mockClear(): MockFn<TReturn>;
  /** Clear call history *and* reset implementation to default. */
  mockReset(): MockFn<TReturn>;
  /** Check if any call was made with the given arguments (deep structural equality). */
  wasCalledWith(...args: unknown[]): boolean;
}

export function createMockFn<TReturn = unknown>(defaultReturn?: TReturn): MockFn<TReturn> {
  const calls: unknown[][] = [];
  let impl: ((...args: unknown[]) => TReturn) | undefined;
  const onceQueue: Array<(...args: unknown[]) => TReturn> = [];

  const fn = ((...args: unknown[]): TReturn => {
    calls.push(args);
    if (onceQueue.length > 0) {
      return onceQueue.shift()!(...args);
    }
    return impl ? impl(...args) : (undefined as TReturn);
  }) as MockFn<TReturn>;

  Object.defineProperty(fn, 'calls', { get: () => calls });
  Object.defineProperty(fn, 'callCount', { get: () => calls.length });
  Object.defineProperty(fn, 'lastCall', { get: () => calls[calls.length - 1] });
  Object.defineProperty(fn, 'wasCalled', { get: () => calls.length > 0 });

  fn.mockReturnValue = (value: TReturn) => {
    impl = () => value;
    return fn;
  };

  fn.mockReturnValueOnce = (value: TReturn) => {
    onceQueue.push(() => value);
    return fn;
  };

  fn.mockResolvedValue = (value: unknown) => {
    impl = () => Promise.resolve(value) as TReturn;
    return fn;
  };

  fn.mockResolvedValueOnce = (value: unknown) => {
    onceQueue.push(() => Promise.resolve(value) as TReturn);
    return fn;
  };

  fn.mockRejectedValue = (error: unknown) => {
    impl = () => Promise.reject(error) as TReturn;
    return fn;
  };

  fn.mockRejectedValueOnce = (error: unknown) => {
    onceQueue.push(() => Promise.reject(error) as TReturn);
    return fn;
  };

  fn.mockImplementation = (f: (...args: unknown[]) => TReturn) => {
    impl = f;
    return fn;
  };

  fn.mockImplementationOnce = (f: (...args: unknown[]) => TReturn) => {
    onceQueue.push(f);
    return fn;
  };

  fn.mockClear = () => {
    calls.length = 0;
    return fn;
  };

  fn.mockReset = () => {
    calls.length = 0;
    onceQueue.length = 0;
    impl = undefined;
    return fn;
  };

  fn.wasCalledWith = (...args: unknown[]) => {
    return calls.some((c) => areEqual(c, args));
  };

  if (defaultReturn !== undefined) {
    impl = () => defaultReturn;
  }

  return fn;
}
