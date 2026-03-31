/**
 * Per-request options that override client-level defaults.
 *
 * @example
 * ```ts
 * const result = await client.chat.completions.create(
 *   { model: 'openai/gpt-4.1-nano', messages: [...] },
 *   { timeout: 30_000, headers: { 'X-Custom': 'value' } },
 * );
 * ```
 */
export interface RequestOptions {
  /** An `AbortSignal` to cancel the request. Combined with the SDK's internal timeout signal. */
  signal?: AbortSignal;
  /** Request timeout in milliseconds. Overrides the client-level `timeout`. */
  timeout?: number;
  /** Extra headers merged into this request only. */
  headers?: Record<string, string>;
}
