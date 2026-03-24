/**
 * Backward-compatible facade for the legacy `@macpaw/ai-sdk/core` entry point.
 * New internal code should prefer the runtime layer.
 */

export * from '../runtime/config';
export * from '../runtime/errors';
export { anySignal } from '../runtime/abort';
export { API_PATHS, DEFAULT_API_VERSION, buildApiPaths } from '../runtime/paths';
export type { ApiPaths, ApiVersion } from '../runtime/paths';
export { runRequest, setDefaultTransport, resetDefaultTransport } from '../runtime/request';
export * from '../runtime/retry';
export * from '../runtime/sse';
export { createStreamTextResult, createStreamResponseResult } from '../runtime/stream-result';
export type { StreamTextResult, StreamResponseResult } from '../runtime/stream-result';
export { createFetchTransport } from '../runtime/transport/fetch';
export type { FetchTransportOptions } from '../runtime/transport/fetch';
export * from '../runtime/validation';
