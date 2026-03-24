/**
 * Per-request options that override client-level defaults.
 *
 * @example
 * ```ts
 * const result = await client.chat.completions.create(
 *   { model: 'openai/gpt-4.1-nano', messages: [...] },
 *   { timeout: 30_000, headers: { 'X-Custom': 'value' } },
 * );
 *
 * // Access response headers
 * const { data, response } = await client.chat.completions.create(
 *   { model: 'openai/gpt-4.1-nano', messages: [...] },
 *   { withResponse: true },
 * );
 * console.log(response.headers.get('x-request-id'));
 * ```
 */
export interface RequestOptions {
  /** An `AbortSignal` to cancel the request. Combined with the SDK's internal timeout signal. */
  signal?: AbortSignal;
  /** Request timeout in milliseconds. Overrides the client-level `timeout`. */
  timeout?: number;
  /** Extra headers merged into this request only. */
  headers?: Record<string, string>;
  /** When `true`, non-streaming methods return `{ data, response }` for header access. */
  withResponse?: boolean;
}

/**
 * Wrapper returned by non-streaming methods when `withResponse: true`.
 * Provides access to both the parsed data and the raw `Response` for header inspection.
 */
export interface WithResponseResult<T> {
  /** The parsed response body. */
  data: T;
  /** The raw `Response` object for header access. */
  response: Response;
}
