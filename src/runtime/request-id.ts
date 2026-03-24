let counter = 0;

/**
 * Generate a unique request ID for correlation.
 * Uses `crypto.randomUUID()` when available (Node 18+, modern browsers)
 * for better uniqueness; falls back to timestamp+counter+random.
 */
export function generateRequestId(prefix: string = 'sdk'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  const timestamp = Date.now().toString(36);
  const count = (counter++).toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${count}-${random}`;
}

/** Case-insensitive check for whether a header key exists in a plain object. */
export function hasHeaderCaseInsensitive(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

/** Case-insensitive check for whether a header key exists in a Headers instance. */
export function headersHasCaseInsensitive(headers: Headers, name: string): boolean {
  return headers.has(name);
}
