/**
 * Combine multiple AbortSignals into one that aborts when ANY of them fires.
 * Useful for merging a user-provided signal with an internal timeout/cancel signal.
 */
export function anySignal(signals: AbortSignal[]): AbortSignal {
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
