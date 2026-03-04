/**
 * Combine multiple AbortSignals into one that aborts when ANY of them fires.
 * Useful for merging a user-provided signal with an internal timeout/cancel signal.
 *
 * Uses the native `AbortSignal.any()` when available (Node 20+, modern browsers)
 * for proper listener cleanup. Falls back to a manual polyfill on older runtimes.
 */
export function anySignal(signals: AbortSignal[]): AbortSignal {
  const any = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  if (typeof any === 'function') {
    return any(signals);
  }

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}
