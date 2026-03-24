import { describe, it, expect } from 'vitest';
import { createMockFn } from '../mock-fn';

describe('createMockFn', () => {
  it('tracks calls and arguments', () => {
    const fn = createMockFn();
    fn('a', 1);
    fn('b', 2);

    expect(fn.callCount).toBe(2);
    expect(fn.calls).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect(fn.lastCall).toEqual(['b', 2]);
  });

  it('returns undefined by default', () => {
    const fn = createMockFn();
    expect(fn()).toBeUndefined();
  });

  it('accepts a default return value', () => {
    const fn = createMockFn<string>('default');
    expect(fn()).toBe('default');
  });

  describe('wasCalled', () => {
    it('is false initially', () => {
      expect(createMockFn().wasCalled).toBe(false);
    });

    it('is true after a call', () => {
      const fn = createMockFn();
      fn();
      expect(fn.wasCalled).toBe(true);
    });
  });

  describe('wasCalledWith', () => {
    it('returns true when matching call exists', () => {
      const fn = createMockFn();
      fn('a', 1);
      fn('b', 2);
      expect(fn.wasCalledWith('b', 2)).toBe(true);
    });

    it('returns false when no matching call', () => {
      const fn = createMockFn();
      fn('a', 1);
      expect(fn.wasCalledWith('c', 3)).toBe(false);
    });

    it('compares Blob arguments without JSON serialization tricks', () => {
      const fn = createMockFn();
      const blob = new Blob(['hello'], { type: 'text/plain' });
      fn(blob);

      expect(fn.wasCalledWith(blob)).toBe(true);
      expect(fn.wasCalledWith(new Blob(['hello'], { type: 'text/plain' }))).toBe(false);
    });
  });

  describe('mockReturnValue', () => {
    it('sets a fixed return', () => {
      const fn = createMockFn<number>();
      fn.mockReturnValue(42);
      expect(fn()).toBe(42);
      expect(fn()).toBe(42);
    });
  });

  describe('mockReturnValueOnce', () => {
    it('returns value only for the next call, then falls back', () => {
      const fn = createMockFn<number>();
      fn.mockReturnValue(0);
      fn.mockReturnValueOnce(1).mockReturnValueOnce(2);

      expect(fn()).toBe(1);
      expect(fn()).toBe(2);
      expect(fn()).toBe(0); // fallback
    });
  });

  describe('mockResolvedValue', () => {
    it('wraps in Promise', async () => {
      const fn = createMockFn<Promise<string>>();
      fn.mockResolvedValue('hello');
      await expect(fn()).resolves.toBe('hello');
    });
  });

  describe('mockResolvedValueOnce', () => {
    it('resolves only for the next call', async () => {
      const fn = createMockFn<Promise<string>>();
      fn.mockResolvedValue('default');
      fn.mockResolvedValueOnce('once');

      await expect(fn()).resolves.toBe('once');
      await expect(fn()).resolves.toBe('default');
    });
  });

  describe('mockRejectedValue', () => {
    it('rejects with the given error', async () => {
      const fn = createMockFn<Promise<string>>();
      fn.mockRejectedValue(new Error('fail'));
      await expect(fn()).rejects.toThrow('fail');
    });
  });

  describe('mockRejectedValueOnce', () => {
    it('rejects only for the next call, then falls back', async () => {
      const fn = createMockFn<Promise<string>>();
      fn.mockResolvedValue('ok');
      fn.mockRejectedValueOnce(new Error('boom'));

      await expect(fn()).rejects.toThrow('boom');
      await expect(fn()).resolves.toBe('ok');
    });
  });

  describe('mockImplementation', () => {
    it('provides custom logic', () => {
      const fn = createMockFn<number>();
      fn.mockImplementation((a: unknown, b: unknown) => (a as number) + (b as number));
      expect(fn(3, 4)).toBe(7);
    });
  });

  describe('mockImplementationOnce', () => {
    it('uses impl for one call then falls back', () => {
      const fn = createMockFn<number>();
      fn.mockReturnValue(0);
      fn.mockImplementationOnce((x: unknown) => (x as number) * 10);

      expect(fn(5)).toBe(50);
      expect(fn(5)).toBe(0);
    });
  });

  describe('mockClear', () => {
    it('clears calls but keeps implementation', () => {
      const fn = createMockFn<number>();
      fn.mockReturnValue(99);
      fn(1);
      fn(2);

      fn.mockClear();
      expect(fn.callCount).toBe(0);
      expect(fn.calls).toEqual([]);
      expect(fn()).toBe(99); // implementation preserved
    });
  });

  describe('mockReset', () => {
    it('clears calls, once-queue, and implementation', () => {
      const fn = createMockFn<number>();
      fn.mockReturnValue(99);
      fn.mockReturnValueOnce(1);
      fn(1);

      fn.mockReset();
      expect(fn.callCount).toBe(0);
      expect(fn()).toBeUndefined(); // impl gone
      expect(fn()).toBeUndefined(); // once-queue gone
    });
  });

  it('chains method calls', () => {
    const fn = createMockFn<number>();
    const result = fn.mockReturnValue(1).mockClear().mockReturnValue(2);
    expect(result).toBe(fn);
    expect(fn()).toBe(2);
  });
});
