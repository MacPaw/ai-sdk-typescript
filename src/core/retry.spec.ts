import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withRetry(fn, { retryConfig: { maxAttempts: 3 } });
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
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
    await expect(
      withRetry(fn, { retryConfig: { maxAttempts: 2, initialDelayMs: 5 } })
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
