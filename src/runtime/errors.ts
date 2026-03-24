/**
 * Error normalization layer: Gateway HTTP API and OpenAI proxy formats -> typed SDK errors.
 *
 * IMPORTANT: parseErrorResponse throws the SPECIFIC subclass (AuthError, CreditsError, etc.)
 * so that `instanceof` checks work correctly in consumer code.
 */

import type { GatewayApiErrorResponse, OpenAIErrorResponse, GatewayApiErrorItem } from '../types';
import { ErrorCode, GatewayApiCode } from '../types';
import type { ErrorCode as ErrorCodeType } from '../types';

/**
 * @deprecated Use `ErrorCode` from `@macpaw/ai-sdk` instead.
 * Kept for backward compatibility — will be removed in a future major version.
 */
export const AIGatewayErrorCodes = ErrorCode;

function mapGatewayApiCodeToNormalized(code: string, statusCode: number): ErrorCodeType {
  switch (code) {
    case GatewayApiCode.Unauthorized:
      return ErrorCode.AuthRequired;
    case GatewayApiCode.InsufficientCredits:
      return statusCode === 402 ? ErrorCode.InsufficientCredits : ErrorCode.SubscriptionExpired;
    case GatewayApiCode.Forbidden:
      return ErrorCode.ModelNotAllowed;
    case GatewayApiCode.RateLimitExceeded:
      return ErrorCode.RateLimited;
    case GatewayApiCode.BadRequest:
      return ErrorCode.BadRequest;
    case GatewayApiCode.Validation:
      return ErrorCode.Validation;
    case GatewayApiCode.InternalServerError:
      return ErrorCode.InternalServerError;
    case GatewayApiCode.ServiceUnavailable:
      return ErrorCode.ServiceUnavailable;
    case GatewayApiCode.Timeout:
      return ErrorCode.Timeout;
    case GatewayApiCode.NotFound:
      return ErrorCode.NotFound;
    case GatewayApiCode.Conflict:
      return ErrorCode.Conflict;
    default:
      return statusCode >= 500 ? ErrorCode.InternalServerError : ErrorCode.BadRequest;
  }
}

function mapOpenAIErrorToNormalized(type?: string | null, code?: string | null): ErrorCodeType {
  if (type === 'authentication_error') return ErrorCode.AuthRequired;
  if (type === 'rate_limit_error') return ErrorCode.RateLimited;
  if (type === 'team_model_access_denied' || code === '403') return ErrorCode.ModelNotAllowed;
  if (type === 'api_error') return ErrorCode.InternalServerError;
  if (type === 'invalid_request_error') return ErrorCode.BadRequest;
  return ErrorCode.InternalServerError;
}

function parseRetryAfterHeader(value: string): number | undefined {
  const seconds = Number(value);
  if (!Number.isNaN(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    const delta = Math.ceil((date - Date.now()) / 1000);
    return delta > 0 ? delta : 0;
  }
  return undefined;
}

export interface NormalizedErrorMetadata {
  paymentUrl?: string;
  /** Suggested delay before retrying, **in seconds** (from the server's `Retry-After`). */
  retryAfter?: number;
  requestId?: string;
  path?: string;
  timestamp?: string;
  errors?: GatewayApiErrorItem[];
}

export class AIGatewayError extends Error {
  readonly code: ErrorCodeType;
  readonly statusCode: number;
  readonly metadata: NormalizedErrorMetadata;

  constructor(
    message: string,
    code: ErrorCodeType,
    statusCode: number,
    metadata: NormalizedErrorMetadata = {},
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = 'AIGatewayError';
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get paymentUrl(): string | undefined {
    return this.metadata.paymentUrl;
  }

  /** Suggested delay before retrying, **in seconds**. `undefined` if not provided by the server. */
  get retryAfter(): number | undefined {
    return this.metadata.retryAfter;
  }

  get requestId(): string | undefined {
    return this.metadata.requestId;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      metadata: this.metadata,
    };
  }
}

export class AuthError extends AIGatewayError {
  constructor(message: string, statusCode: number, metadata?: NormalizedErrorMetadata, options?: { cause?: unknown }) {
    super(message, ErrorCode.AuthRequired, statusCode, metadata, options);
    this.name = 'AuthError';
  }
}

export class CreditsError extends AIGatewayError {
  constructor(
    message: string,
    statusCode: number,
    code: typeof ErrorCode.InsufficientCredits | typeof ErrorCode.SubscriptionExpired,
    metadata?: NormalizedErrorMetadata,
    options?: { cause?: unknown },
  ) {
    super(message, code, statusCode, metadata, options);
    this.name = 'CreditsError';
  }
}

export class RateLimitError extends AIGatewayError {
  constructor(message: string, statusCode: number, metadata?: NormalizedErrorMetadata, options?: { cause?: unknown }) {
    super(message, ErrorCode.RateLimited, statusCode, metadata, options);
    this.name = 'RateLimitError';
  }
}

export class ModelNotAllowedError extends AIGatewayError {
  constructor(message: string, statusCode: number, metadata?: NormalizedErrorMetadata, options?: { cause?: unknown }) {
    super(message, ErrorCode.ModelNotAllowed, statusCode, metadata, options);
    this.name = 'ModelNotAllowedError';
  }
}

export class ValidationError extends AIGatewayError {
  constructor(message: string, statusCode: number, metadata?: NormalizedErrorMetadata, options?: { cause?: unknown }) {
    super(message, ErrorCode.Validation, statusCode, metadata, options);
    this.name = 'ValidationError';
  }
}

/** Type guard: returns true if the value is an AIGatewayError (or any subclass). */
export function isAIGatewayError(value: unknown): value is AIGatewayError {
  return value instanceof AIGatewayError;
}

/**
 * Create the appropriate error subclass based on the normalized error code.
 * This ensures `instanceof AuthError`, `instanceof CreditsError`, etc. work.
 */
function createTypedError(
  message: string,
  code: ErrorCodeType,
  statusCode: number,
  meta: NormalizedErrorMetadata,
  options?: { cause?: unknown },
): AIGatewayError {
  switch (code) {
    case ErrorCode.AuthRequired:
      return new AuthError(message, statusCode, meta, options);
    case ErrorCode.InsufficientCredits:
    case ErrorCode.SubscriptionExpired:
      return new CreditsError(message, statusCode, code, meta, options);
    case ErrorCode.RateLimited:
      return new RateLimitError(message, statusCode, meta, options);
    case ErrorCode.ModelNotAllowed:
      return new ModelNotAllowedError(message, statusCode, meta, options);
    case ErrorCode.Validation:
      return new ValidationError(message, statusCode, meta, options);
    default:
      return new AIGatewayError(message, code, statusCode, meta, options);
  }
}

export async function parseErrorResponseFromResponse(response: Response): Promise<never> {
  const contentType = response.headers.get('Content-Type') ?? '';
  let body: unknown;

  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = { message: response.statusText };
    }
  } else {
    body = { message: await response.text().catch(() => response.statusText) };
  }

  try {
    parseErrorResponse(response.status, body);
  } catch (error) {
    if (error instanceof AIGatewayError && error.retryAfter == null) {
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        const seconds = parseRetryAfterHeader(retryAfter);
        if (seconds != null) {
          error.metadata.retryAfter = seconds;
        }
      }
    }
    throw error;
  }
}

/**
 * Normalize an SSE `event: error` payload into a typed AIGatewayError subclass.
 * Uses the same code-mapping and subclass logic as `parseErrorResponse` so that
 * `instanceof AuthError`, `instanceof RateLimitError` etc. work consistently
 * in both streaming and non-streaming paths.
 */
export function parseStreamErrorPayload(payload: {
  message?: string;
  code?: string;
  statusCode?: number;
  metadata?: Record<string, unknown>;
}): AIGatewayError {
  const statusCode = payload.statusCode ?? 500;
  const rawCode = payload.code ?? 'INTERNAL_SERVER_ERROR';
  const message = payload.message ?? 'Stream error';
  const meta: NormalizedErrorMetadata = {};
  if (payload.metadata) {
    if (typeof payload.metadata.paymentUrl === 'string') meta.paymentUrl = payload.metadata.paymentUrl;
    if (typeof payload.metadata.retryAfter === 'number') meta.retryAfter = payload.metadata.retryAfter;
    if (typeof payload.metadata.requestId === 'string') meta.requestId = payload.metadata.requestId;
  }
  const normalizedCode = mapGatewayApiCodeToNormalized(rawCode, statusCode);
  return createTypedError(message, normalizedCode, statusCode, meta);
}

/**
 * Parse error response body and throw appropriate AIGatewayError subclass.
 * Handles both Gateway API format and OpenAI proxy format.
 */
export function parseErrorResponse(statusCode: number, body: unknown): never {
  const meta: NormalizedErrorMetadata = {};

  if (body && typeof body === 'object') {
    if ('request_id' in body && typeof (body as { request_id?: string }).request_id === 'string') {
      meta.requestId = (body as { request_id: string }).request_id;
    }
    if ('path' in body && typeof (body as { path?: string }).path === 'string') {
      meta.path = (body as { path: string }).path;
    }
    if ('timestamp' in body && typeof (body as { timestamp?: string }).timestamp === 'string') {
      meta.timestamp = (body as { timestamp: string }).timestamp;
    }
  }

  const gatewayBody = body as GatewayApiErrorResponse | undefined;
  if (gatewayBody?.statusCode != null && typeof gatewayBody.message === 'string' && gatewayBody.code) {
    const code = mapGatewayApiCodeToNormalized(gatewayBody.code, gatewayBody.statusCode);
    if (gatewayBody.errors?.length) meta.errors = gatewayBody.errors;
    const firstError = gatewayBody.errors?.[0];
    if (firstError?.metadata) {
      if (typeof firstError.metadata.paymentUrl === 'string') meta.paymentUrl = firstError.metadata.paymentUrl;
      if (typeof firstError.metadata.retryAfter === 'number') meta.retryAfter = firstError.metadata.retryAfter;
    }
    throw createTypedError(gatewayBody.message, code, gatewayBody.statusCode, meta);
  }

  const oai = body as OpenAIErrorResponse | undefined;
  if (oai?.error?.message) {
    const code = mapOpenAIErrorToNormalized(oai.error.type, oai.error.code);
    if (oai.request_id) meta.requestId = oai.request_id;
    throw createTypedError(oai.error.message, code, statusCode, meta);
  }

  const message =
    typeof (body as { message?: string })?.message === 'string'
      ? (body as { message: string }).message
      : `Request failed with status ${statusCode}`;

  let fallbackCode: ErrorCodeType;
  if (statusCode === 401) fallbackCode = ErrorCode.AuthRequired;
  else if (statusCode === 429) fallbackCode = ErrorCode.RateLimited;
  else if (statusCode >= 500) fallbackCode = ErrorCode.InternalServerError;
  else fallbackCode = ErrorCode.BadRequest;

  throw createTypedError(message, fallbackCode, statusCode, meta);
}
