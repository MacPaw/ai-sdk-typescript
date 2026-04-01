import { describe, it, expect } from 'vitest';
import {
  parseStreamErrorPayload,
  parseErrorResponse,
  parseErrorResponseFromResponse,
  AuthError,
  CreditsError,
  RateLimitError,
  ModelNotAllowedError,
  GatewayValidationError,
  AIGatewayError,
  ErrorCode,
} from '../gateway-errors';

// ─── parseStreamErrorPayload ──────────────────────────────────────────────────

describe('parseStreamErrorPayload', () => {
  it('returns AuthError for UNAUTHORIZED code', () => {
    const err = parseStreamErrorPayload({ code: 'UNAUTHORIZED', statusCode: 401, message: 'Not authorized' });
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe(ErrorCode.AuthRequired);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Not authorized');
  });

  it('returns CreditsError (InsufficientCredits) for 402', () => {
    const err = parseStreamErrorPayload({ code: 'INSUFFICIENT_CREDITS', statusCode: 402 });
    expect(err).toBeInstanceOf(CreditsError);
    expect(err.code).toBe(ErrorCode.InsufficientCredits);
  });

  it('returns CreditsError (SubscriptionExpired) for 403 + INSUFFICIENT_CREDITS', () => {
    const err = parseStreamErrorPayload({ code: 'INSUFFICIENT_CREDITS', statusCode: 403 });
    expect(err).toBeInstanceOf(CreditsError);
    expect(err.code).toBe(ErrorCode.SubscriptionExpired);
  });

  it('returns RateLimitError for RATE_LIMIT_EXCEEDED', () => {
    const err = parseStreamErrorPayload({ code: 'RATE_LIMIT_EXCEEDED', statusCode: 429 });
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.code).toBe(ErrorCode.RateLimited);
  });

  it('returns ModelNotAllowedError for FORBIDDEN', () => {
    const err = parseStreamErrorPayload({ code: 'FORBIDDEN', statusCode: 403 });
    expect(err).toBeInstanceOf(ModelNotAllowedError);
    expect(err.code).toBe(ErrorCode.ModelNotAllowed);
  });

  it('returns GatewayValidationError for VALIDATION', () => {
    const err = parseStreamErrorPayload({ code: 'VALIDATION', statusCode: 422 });
    expect(err).toBeInstanceOf(GatewayValidationError);
    expect(err.code).toBe(ErrorCode.Validation);
  });

  it('returns AIGatewayError with InternalServerError for unknown code on 5xx', () => {
    const err = parseStreamErrorPayload({ code: 'UNKNOWN_CODE', statusCode: 503 });
    expect(err).toBeInstanceOf(AIGatewayError);
    expect(err.code).toBe(ErrorCode.InternalServerError);
  });

  it('returns AIGatewayError with BadRequest for unknown code on 4xx', () => {
    const err = parseStreamErrorPayload({ code: 'UNKNOWN_CODE', statusCode: 400 });
    expect(err).toBeInstanceOf(AIGatewayError);
    expect(err.code).toBe(ErrorCode.BadRequest);
  });

  it('uses defaults when all fields omitted', () => {
    const err = parseStreamErrorPayload({});
    expect(err).toBeInstanceOf(AIGatewayError);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('Stream error');
  });

  it('extracts paymentUrl from metadata', () => {
    const err = parseStreamErrorPayload({
      code: 'INSUFFICIENT_CREDITS',
      statusCode: 402,
      metadata: { paymentUrl: 'https://pay.example.com' },
    });
    expect(err.paymentUrl).toBe('https://pay.example.com');
  });

  it('extracts retryAfter from metadata', () => {
    const err = parseStreamErrorPayload({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      metadata: { retryAfter: 30 },
    });
    expect(err.retryAfter).toBe(30);
  });

  it('extracts requestId from metadata', () => {
    const err = parseStreamErrorPayload({
      metadata: { requestId: 'req-abc-123' },
    });
    expect(err.requestId).toBe('req-abc-123');
  });

  it('ignores metadata fields with wrong types', () => {
    const err = parseStreamErrorPayload({
      metadata: {
        paymentUrl: 123 as unknown as string,
        retryAfter: 'not-a-number' as unknown as number,
        requestId: true as unknown as string,
      },
    });
    expect(err.paymentUrl).toBeUndefined();
    expect(err.retryAfter).toBeUndefined();
    expect(err.requestId).toBeUndefined();
  });
});

// ─── parseErrorResponse ───────────────────────────────────────────────────────

describe('parseErrorResponse', () => {
  // Gateway API format
  it('throws AuthError for gateway body with UNAUTHORIZED code', () => {
    expect(() =>
      parseErrorResponse(401, { statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' }),
    ).toThrow(AuthError);
  });

  it('throws CreditsError for gateway body with INSUFFICIENT_CREDITS at 402', () => {
    expect(() =>
      parseErrorResponse(402, { statusCode: 402, message: 'No credits', code: 'INSUFFICIENT_CREDITS' }),
    ).toThrow(CreditsError);
  });

  it('throws GatewayValidationError for gateway body with VALIDATION', () => {
    expect(() =>
      parseErrorResponse(422, { statusCode: 422, message: 'Validation failed', code: 'VALIDATION' }),
    ).toThrow(GatewayValidationError);
  });

  it('includes errors array in metadata from gateway body', () => {
    try {
      parseErrorResponse(422, {
        statusCode: 422,
        message: 'Invalid',
        code: 'VALIDATION',
        errors: [{ property: 'model', message: 'required' }],
      });
    } catch (e) {
      expect((e as AIGatewayError).metadata.errors).toHaveLength(1);
    }
  });

  it('extracts paymentUrl from first error metadata in gateway body', () => {
    try {
      parseErrorResponse(402, {
        statusCode: 402,
        message: 'No credits',
        code: 'INSUFFICIENT_CREDITS',
        errors: [{ metadata: { paymentUrl: 'https://pay.macpaw.com' } }],
      });
    } catch (e) {
      expect((e as AIGatewayError).paymentUrl).toBe('https://pay.macpaw.com');
    }
  });

  // OpenAI format
  it('throws AuthError for OpenAI error body with authentication_error type', () => {
    expect(() =>
      parseErrorResponse(401, { error: { message: 'Invalid key', type: 'authentication_error' } }),
    ).toThrow(AuthError);
  });

  it('throws RateLimitError for OpenAI error body with rate_limit_error type', () => {
    expect(() =>
      parseErrorResponse(429, { error: { message: 'Rate limited', type: 'rate_limit_error' } }),
    ).toThrow(RateLimitError);
  });

  it('throws AuthError for OpenAI error body without type on 401', () => {
    expect(() => parseErrorResponse(401, { error: { message: 'Unauthorized' } })).toThrow(AuthError);
  });

  it('throws RateLimitError for OpenAI error body without type on 429', () => {
    expect(() => parseErrorResponse(429, { error: { message: 'Slow down' } })).toThrow(RateLimitError);
  });

  it('throws ModelNotAllowedError for OpenAI error body without type on 403', () => {
    expect(() => parseErrorResponse(403, { error: { message: 'Forbidden' } })).toThrow(ModelNotAllowedError);
  });

  it('includes request_id from OpenAI body in metadata', () => {
    try {
      parseErrorResponse(429, { error: { message: 'Rate limited' }, request_id: 'req-oai-1' });
    } catch (e) {
      expect((e as AIGatewayError).requestId).toBe('req-oai-1');
    }
  });

  // Fallback paths (no recognizable body format)
  it('fallback: throws AuthError for 401 with empty object', () => {
    expect(() => parseErrorResponse(401, {})).toThrow(AuthError);
  });

  it('fallback: throws AIGatewayError with Forbidden code for 403', () => {
    try {
      parseErrorResponse(403, {});
    } catch (e) {
      expect(e).toBeInstanceOf(AIGatewayError);
      expect((e as AIGatewayError).code).toBe(ErrorCode.Forbidden);
    }
  });

  it('fallback: throws RateLimitError for 429', () => {
    expect(() => parseErrorResponse(429, {})).toThrow(RateLimitError);
  });

  it('fallback: throws AIGatewayError with InternalServerError for 500', () => {
    try {
      parseErrorResponse(500, {});
    } catch (e) {
      expect((e as AIGatewayError).code).toBe(ErrorCode.InternalServerError);
    }
  });

  it('fallback: throws AIGatewayError with InternalServerError for 503', () => {
    try {
      parseErrorResponse(503, null);
    } catch (e) {
      expect((e as AIGatewayError).code).toBe(ErrorCode.InternalServerError);
    }
  });

  it('fallback: throws AIGatewayError with BadRequest for generic 4xx', () => {
    try {
      parseErrorResponse(400, {});
    } catch (e) {
      expect((e as AIGatewayError).code).toBe(ErrorCode.BadRequest);
    }
  });

  it('fallback: uses body.message when present', () => {
    try {
      parseErrorResponse(400, { message: 'Custom error message' });
    } catch (e) {
      expect((e as Error).message).toBe('Custom error message');
    }
  });

  it('fallback: generates generic message when body is null', () => {
    try {
      parseErrorResponse(400, null);
    } catch (e) {
      expect((e as Error).message).toBe('Request failed with status 400');
    }
  });

  it('fallback: generates generic message when body.message is not a string', () => {
    try {
      parseErrorResponse(502, { message: 42 });
    } catch (e) {
      expect((e as Error).message).toBe('Request failed with status 502');
    }
  });

  it('includes request_id from body metadata in all paths', () => {
    try {
      parseErrorResponse(500, { request_id: 'req-fallback', message: 'oops' });
    } catch (e) {
      expect((e as AIGatewayError).requestId).toBe('req-fallback');
    }
  });
});

// ─── parseErrorResponseFromResponse ──────────────────────────────────────────

describe('parseErrorResponseFromResponse', () => {
  it('parses gateway JSON body and throws correct subclass', async () => {
    const body = JSON.stringify({ statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' });
    const response = new Response(body, { status: 401, headers: { 'Content-Type': 'application/json' } });
    await expect(parseErrorResponseFromResponse(response)).rejects.toBeInstanceOf(AuthError);
  });

  it('parses non-JSON content type as plain text', async () => {
    const response = new Response('Internal Server Error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
    await expect(parseErrorResponseFromResponse(response)).rejects.toBeInstanceOf(AIGatewayError);
  });

  it('falls back gracefully when JSON parse fails', async () => {
    const response = new Response('not-json{{{', {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(parseErrorResponseFromResponse(response)).rejects.toBeInstanceOf(AIGatewayError);
  });

  it('applies Retry-After as numeric seconds to error metadata', async () => {
    const body = JSON.stringify({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' });
    const response = new Response(body, {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
    try {
      await parseErrorResponseFromResponse(response);
    } catch (e) {
      expect((e as AIGatewayError).retryAfter).toBe(60);
    }
  });

  it('applies Retry-After as HTTP-date to error metadata', async () => {
    // Gateway may return HTTP-date (RFC 7231) in Retry-After.
    const futureDate = new Date(Date.now() + 120_000).toUTCString();
    const body = JSON.stringify({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' });
    const response = new Response(body, {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': futureDate },
    });
    try {
      await parseErrorResponseFromResponse(response);
    } catch (e) {
      // Should be positive seconds (roughly 120, but allow clock skew)
      expect((e as AIGatewayError).retryAfter).toBeGreaterThan(0);
    }
  });

  it('ignores invalid Retry-After header value', async () => {
    const body = JSON.stringify({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' });
    const response = new Response(body, {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': 'not-a-date-or-number' },
    });
    try {
      await parseErrorResponseFromResponse(response);
    } catch (e) {
      expect((e as AIGatewayError).retryAfter).toBeUndefined();
    }
  });

  it('skips Retry-After header when error body already has retryAfter in metadata', async () => {
    // Body-level retryAfter takes precedence — header only fills in when absent.
    const body = JSON.stringify({
      statusCode: 429,
      message: 'Rate limited',
      code: 'RATE_LIMIT_EXCEEDED',
      errors: [{ metadata: { retryAfter: 10 } }],
    });
    const response = new Response(body, {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '999' },
    });
    try {
      await parseErrorResponseFromResponse(response);
    } catch (e) {
      // Body-specified value wins
      expect((e as AIGatewayError).retryAfter).toBe(10);
    }
  });

  it('applies Retry-After from header when body has no retryAfter', async () => {
    // Pure gateway body without errors[] carrying retryAfter.
    const body = JSON.stringify({ statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' });
    const response = new Response(body, {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
    });
    try {
      await parseErrorResponseFromResponse(response);
    } catch (e) {
      expect((e as AIGatewayError).retryAfter).toBe(5);
    }
  });
});
