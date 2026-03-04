import { describe, it, expect } from 'vitest';
import { anySignal } from './abort';

describe('anySignal', () => {
  it('returns a signal that is not aborted when none of the inputs are', () => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const combined = anySignal([ac1.signal, ac2.signal]);
    expect(combined.aborted).toBe(false);
  });

  it('aborts when the first signal aborts', () => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const combined = anySignal([ac1.signal, ac2.signal]);

    ac1.abort('reason-1');
    expect(combined.aborted).toBe(true);
    expect(combined.reason).toBe('reason-1');
  });

  it('aborts when the second signal aborts', () => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const combined = anySignal([ac1.signal, ac2.signal]);

    ac2.abort('reason-2');
    expect(combined.aborted).toBe(true);
    expect(combined.reason).toBe('reason-2');
  });

  it('returns already-aborted signal if any input is pre-aborted', () => {
    const ac1 = new AbortController();
    ac1.abort('pre-aborted');
    const ac2 = new AbortController();

    const combined = anySignal([ac1.signal, ac2.signal]);
    expect(combined.aborted).toBe(true);
    expect(combined.reason).toBe('pre-aborted');
  });

  it('works with a single signal', () => {
    const ac = new AbortController();
    const combined = anySignal([ac.signal]);

    ac.abort();
    expect(combined.aborted).toBe(true);
  });

  it('propagates the reason from the first signal to fire', () => {
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const combined = anySignal([ac1.signal, ac2.signal]);

    const error = new Error('timeout');
    ac2.abort(error);
    expect(combined.reason).toBe(error);
  });
});
