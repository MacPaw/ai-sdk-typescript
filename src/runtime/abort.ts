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
  const handlers: Array<[AbortSignal, () => void]> = [];

  function cleanup() {
    for (const [sig, handler] of handlers) {
      sig.removeEventListener('abort', handler);
    }
    handlers.length = 0;
  }

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    const handler = () => {
      cleanup();
      controller.abort(signal.reason);
    };
    handlers.push([signal, handler]);
    signal.addEventListener('abort', handler, { once: true });
  }

  const result = controller.signal;
  result.addEventListener('abort', cleanup, { once: true });

  return result;
}
