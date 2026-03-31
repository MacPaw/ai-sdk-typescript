/**
 * Domain types for the AI Gateway SDK (OpenAI-compatible HTTP API).
 *
 * Modules that intentionally expose matching runtime constants and type aliases
 * (for example `ErrorCode` and `type ErrorCode`) stay on `export *` to preserve
 * the ergonomic import surface without reintroducing the giant barrel everywhere.
 */

export type { ObjectValues } from './util';
export * from './codes';
export type { GatewayApiErrorItem, GatewayApiErrorResponse, OpenAIErrorResponse } from './error-shapes';
export * from './chat';
export * from './responses';
export * from './embeddings';
export * from './images';
export * from './audio';
export type { ModelInfo, ModelEntry, ModelInfoResponse } from './models';
export type { RequestOptions } from './request-options';
