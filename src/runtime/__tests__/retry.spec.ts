import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../index';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withRetry(fn, { retryConfig: { maxAttempts: 3 } });
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('normalizes maxAttempts 0 so fn runs at least once', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { retryConfig: { maxAttempts: 0 } });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('normalizes invalid maxAttempts and retries up to default attempts', async () => {
    const err = Object.assign(new Error('rate limit'), { statusCode: 429 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retryConfig: { maxAttempts: 0, initialDelayMs: 1, maxDelayMs: 1 } })).rejects.toBe(
      err,
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries on retryable status (429) and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limit'), { statusCode: 429 }))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { retryConfig: { maxAttempts: 3, initialDelayMs: 10 } });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 402', async () => {
    const err = Object.assign(new Error('payment required'), { statusCode: 402 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retryConfig: { maxAttempts: 3 } })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 401', async () => {
    const err = Object.assign(new Error('unauthorized'), { statusCode: 401 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retryConfig: { maxAttempts: 3 } })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 and then throws after maxAttempts', async () => {
    const err = Object.assign(new Error('server error'), { statusCode: 500 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retryConfig: { maxAttempts: 2, initialDelayMs: 5 } })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('aborts delay immediately when signal fires during backoff', async () => {
    const ac = new AbortController();
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('rate limit'), { statusCode: 429 }));

    const promise = withRetry(fn, {
      retryConfig: { maxAttempts: 3, initialDelayMs: 60_000 },
      signal: ac.signal,
    });

    await new Promise((r) => setTimeout(r, 50));
    ac.abort(new Error('user cancelled'));

    await expect(promise).rejects.toThrow('user cancelled');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects custom retryableStatuses — does not retry 500 when only 429 is listed', async () => {
    const err = Object.assign(new Error('server error'), { statusCode: 500 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retryConfig: { maxAttempts: 3, retryableStatuses: [429] } })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
