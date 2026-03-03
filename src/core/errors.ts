/**
 * Error normalization layer: BFF and OpenAI proxy formats -> typed SDK errors.
 *
 * IMPORTANT: parseErrorResponse throws the SPECIFIC subclass (AuthError, CreditsError, etc.)
 * so that `instanceof` checks work correctly in consumer code.
 */

import type { BFFErrorResponse, OpenAIErrorResponse, BFFErrorItem } from './types';
import { ErrorCode, BFFCode } from './types';
import type { ErrorCode as ErrorCodeType } from './types';

/**
 * @deprecated Use `ErrorCode` from `@macpaw/ai-sdk` instead.
 * Kept for backward compatibility — will be removed in a future major version.
 */
export const AIGatewayErrorCodes = ErrorCode;

function mapBFFCodeToNormalized(code: string, statusCode: number): ErrorCodeType {
  switch (code) {
    case BFFCode.Unauthorized:
      return ErrorCode.AuthRequired;
    case BFFCode.InsufficientCredits:
      return statusCode === 402 ? ErrorCode.InsufficientCredits : ErrorCode.SubscriptionExpired;
    case BFFCode.Forbidden:
      return ErrorCode.ModelNotAllowed;
    case BFFCode.RateLimitExceeded:
      return ErrorCode.RateLimited;
    case BFFCode.BadRequest:
      return ErrorCode.BadRequest;
    case BFFCode.Validation:
      return ErrorCode.Validation;
    case BFFCode.InternalServerError:
      return ErrorCode.InternalServerError;
    case BFFCode.ServiceUnavailable:
      return ErrorCode.ServiceUnavailable;
    case BFFCode.Timeout:
      return ErrorCode.Timeout;
    case BFFCode.NotFound:
      return ErrorCode.NotFound;
    case BFFCode.Conflict:
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

export interface NormalizedErrorMetadata {
  paymentUrl?: string;
  retryAfter?: number;
  requestId?: string;
  path?: string;
  timestamp?: string;
  errors?: BFFErrorItem[];
}

export class AIGatewayError extends Error {
  readonly code: ErrorCodeType;
  readonly statusCode: number;
  readonly metadata: NormalizedErrorMetadata;

  constructor(
    message: string,
    code: ErrorCodeType,
    statusCode: number,
    metadata: NormalizedErrorMetadata = {}
  ) {
    super(message);
    this.name = 'AIGatewayError';
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get paymentUrl(): string | undefined {
    return this.metadata.paymentUrl;
  }

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
  constructor(message: string, statusCode: number, metadata?: NormalizedErrorMetadata) {
    super(message, ErrorCode.AuthRequired, statusCode, metadata);
    this.name = 'AuthError';
  }
}

export class CreditsError extends AIGatewayError {
  constructor(
    message: string,
    statusCode: number,
    code: typeof ErrorCode.InsufficientCredits | typeof ErrorCode.SubscriptionExpired,
    metadata?: NormalizedErrorMetadata
  ) {
    super(message, code, statusCode, metadata);
    this.name = 'CreditsError';
  }
}

export class RateLimitError extends AIGatewayError {
  constructor(message: string, statusCode: number, metadata?: NormalizedErrorMetadata) {
    super(message, ErrorCode.RateLimited, statusCode, metadata);
    this.name = 'RateLimitError';
  }
}

export class ModelNotAllowedError extends AIGatewayError {
  constructor(message: string, statusCode: number, metadata?: NormalizedErrorMetadata) {
    super(message, ErrorCode.ModelNotAllowed, statusCode, metadata);
    this.name = 'ModelNotAllowedError';
  }
}

export class ValidationError extends AIGatewayError {
  constructor(message: string, statusCode: number, metadata?: NormalizedErrorMetadata) {
    super(message, ErrorCode.Validation, statusCode, metadata);
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
  meta: NormalizedErrorMetadata
): AIGatewayError {
  switch (code) {
    case ErrorCode.AuthRequired:
      return new AuthError(message, statusCode, meta);
    case ErrorCode.InsufficientCredits:
    case ErrorCode.SubscriptionExpired:
      return new CreditsError(message, statusCode, code, meta);
    case ErrorCode.RateLimited:
      return new RateLimitError(message, statusCode, meta);
    case ErrorCode.ModelNotAllowed:
      return new ModelNotAllowedError(message, statusCode, meta);
    case ErrorCode.Validation:
      return new ValidationError(message, statusCode, meta);
    default:
      return new AIGatewayError(message, code, statusCode, meta);
  }
}

/**
 * Parse error response body and throw appropriate AIGatewayError subclass.
 * Handles both BFF format and OpenAI proxy format.
 */
export function parseErrorResponse(
  statusCode: number,
  body: unknown
): never {
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

  // BFF format
  const bff = body as BFFErrorResponse | undefined;
  if (bff?.statusCode != null && typeof bff.message === 'string' && bff.code) {
    const code = mapBFFCodeToNormalized(bff.code, bff.statusCode);
    if (bff.errors?.length) meta.errors = bff.errors;
    const firstError = bff.errors?.[0];
    if (firstError?.metadata) {
      if (typeof firstError.metadata.paymentUrl === 'string') meta.paymentUrl = firstError.metadata.paymentUrl;
      if (typeof firstError.metadata.retryAfter === 'number') meta.retryAfter = firstError.metadata.retryAfter;
    }
    throw createTypedError(bff.message, code, bff.statusCode, meta);
  }

  // OpenAI proxy format
  const oai = body as OpenAIErrorResponse | undefined;
  if (oai?.error?.message) {
    const code = mapOpenAIErrorToNormalized(oai.error.type, oai.error.code);
    if (oai.request_id) meta.requestId = oai.request_id;
    throw createTypedError(oai.error.message, code, statusCode, meta);
  }

  // Fallback
  const message =
    typeof (body as { message?: string })?.message === 'string'
      ? (body as { message: string }).message
      : `Request failed with status ${statusCode}`;
  throw createTypedError(
    message,
    statusCode >= 500 ? ErrorCode.InternalServerError : ErrorCode.BadRequest,
    statusCode,
    meta
  );
}
