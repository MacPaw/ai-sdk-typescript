import type { ObjectValues } from './util';

/** Raw error codes returned by the AI Gateway HTTP API. */
export const GatewayApiCode = {
  BadRequest: 'BAD_REQUEST',
  Unauthorized: 'UNAUTHORIZED',
  InsufficientCredits: 'INSUFFICIENT_CREDITS',
  Forbidden: 'FORBIDDEN',
  Validation: 'VALIDATION',
  RateLimitExceeded: 'RATE_LIMIT_EXCEEDED',
  InternalServerError: 'INTERNAL_SERVER_ERROR',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
  Timeout: 'TIMEOUT',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
} as const;
export type GatewayApiCode = ObjectValues<typeof GatewayApiCode>;

/** Normalized error codes for app handling (User Story AC). */
export const ErrorCode = {
  AuthRequired: 'AUTH_REQUIRED',
  InsufficientCredits: 'INSUFFICIENT_CREDITS',
  SubscriptionExpired: 'SUBSCRIPTION_EXPIRED',
  ModelNotAllowed: 'MODEL_NOT_ALLOWED',
  RateLimited: 'RATE_LIMITED',
  BadRequest: 'BAD_REQUEST',
  Validation: 'VALIDATION',
  Forbidden: 'FORBIDDEN',
  InternalServerError: 'INTERNAL_SERVER_ERROR',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
  Timeout: 'TIMEOUT',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
} as const;
export type ErrorCode = ObjectValues<typeof ErrorCode>;
