import { describe, it, expect } from 'vitest';
import {
  parseErrorResponse,
  AIGatewayError,
  AuthError,
  CreditsError,
  RateLimitError,
  ModelNotAllowedError,
  ValidationError,
  isAIGatewayError,
} from './errors';

describe('parseErrorResponse', () => {
  it('parses BFF format and throws AIGatewayError with normalized code', () => {
    const body = {
      statusCode: 401,
      message: 'Unauthorized access',
      timestamp: '2026-02-12T10:26:20.014Z',
      code: 'UNAUTHORIZED',
      path: '/api/v1/chat/completions',
    };
    expect(() => parseErrorResponse(401, body)).toThrow(AIGatewayError);
    try {
      parseErrorResponse(401, body);
    } catch (e) {
      expect((e as AIGatewayError).code).toBe('AUTH_REQUIRED');
      expect((e as AIGatewayError).statusCode).toBe(401);
      expect((e as AIGatewayError).message).toBe('Unauthorized access');
    }
  });

  it('maps INSUFFICIENT_CREDITS to INSUFFICIENT_CREDITS and includes paymentUrl', () => {
    const body = {
      statusCode: 402,
      message: 'Payment required',
      code: 'INSUFFICIENT_CREDITS',
      errors: [
        {
          target: 'operation.authorization',
          metadata: { paymentUrl: 'https://setapp.com/payment' },
        },
      ],
    };
    try {
      parseErrorResponse(402, body);
    } catch (e) {
      expect((e as AIGatewayError).code).toBe('INSUFFICIENT_CREDITS');
      expect((e as AIGatewayError).paymentUrl).toBe('https://setapp.com/payment');
    }
  });

  it('maps FORBIDDEN to MODEL_NOT_ALLOWED', () => {
    const body = {
      statusCode: 403,
      message: 'Forbidden',
      code: 'FORBIDDEN',
    };
    try {
      parseErrorResponse(403, body);
    } catch (e) {
      expect((e as AIGatewayError).code).toBe('MODEL_NOT_ALLOWED');
    }
  });

  it('maps RATE_LIMIT_EXCEEDED to RATE_LIMITED and preserves retryAfter', () => {
    const body = {
      statusCode: 429,
      message: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      errors: [{ metadata: { retryAfter: 60 } }],
    };
    try {
      parseErrorResponse(429, body);
    } catch (e) {
      expect((e as AIGatewayError).code).toBe('RATE_LIMITED');
      expect((e as AIGatewayError).retryAfter).toBe(60);
    }
  });

  it('parses OpenAI proxy format and normalizes code', () => {
    const body = {
      error: { message: 'Invalid API key', type: 'authentication_error' },
      request_id: 'req_123',
    };
    try {
      parseErrorResponse(401, body);
    } catch (e) {
      expect((e as AIGatewayError).code).toBe('AUTH_REQUIRED');
      expect((e as AIGatewayError).requestId).toBe('req_123');
    }
  });

});

describe('error subclass instanceof', () => {
  it('throws AuthError on 401 UNAUTHORIZED', () => {
    try {
      parseErrorResponse(401, {
        statusCode: 401, message: 'Unauthorized', code: 'UNAUTHORIZED', timestamp: '',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect(e).toBeInstanceOf(AIGatewayError);
      expect((e as AuthError).name).toBe('AuthError');
    }
  });

  it('throws CreditsError on 402 INSUFFICIENT_CREDITS', () => {
    try {
      parseErrorResponse(402, {
        statusCode: 402, message: 'Payment required', code: 'INSUFFICIENT_CREDITS', timestamp: '',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(CreditsError);
      expect(e).toBeInstanceOf(AIGatewayError);
      expect((e as CreditsError).code).toBe('INSUFFICIENT_CREDITS');
    }
  });

  it('throws RateLimitError on 429 RATE_LIMIT_EXCEEDED', () => {
    try {
      parseErrorResponse(429, {
        statusCode: 429, message: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED', timestamp: '',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect(e).toBeInstanceOf(AIGatewayError);
    }
  });

  it('throws ModelNotAllowedError on 403 FORBIDDEN', () => {
    try {
      parseErrorResponse(403, {
        statusCode: 403, message: 'Forbidden', code: 'FORBIDDEN', timestamp: '',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ModelNotAllowedError);
      expect(e).toBeInstanceOf(AIGatewayError);
    }
  });

  it('throws ValidationError on 422 VALIDATION', () => {
    try {
      parseErrorResponse(422, {
        statusCode: 422, message: 'Validation failed', code: 'VALIDATION', timestamp: '',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(e).toBeInstanceOf(AIGatewayError);
    }
  });

  it('throws generic AIGatewayError for other codes', () => {
    try {
      parseErrorResponse(500, {
        statusCode: 500, message: 'Server error', code: 'INTERNAL_SERVER_ERROR', timestamp: '',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(AIGatewayError);
      expect(e).not.toBeInstanceOf(AuthError);
      expect(e).not.toBeInstanceOf(CreditsError);
    }
  });

  it('fallback throws AuthError for 401 with unexpected body format', () => {
    try {
      parseErrorResponse(401, { unexpected: 'format' });
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).code).toBe('AUTH_REQUIRED');
      expect((e as AuthError).statusCode).toBe(401);
    }
  });

  it('fallback throws RateLimitError for 429 with unexpected body format', () => {
    try {
      parseErrorResponse(429, 'plain text');
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect((e as RateLimitError).code).toBe('RATE_LIMITED');
    }
  });
});

describe('toJSON', () => {
  it('serializes AIGatewayError to a plain object', () => {
    const err = new AIGatewayError('Something failed', 'BAD_REQUEST', 400, {
      requestId: 'req-1',
      path: '/api/v1/test',
    });
    const json = err.toJSON();
    expect(json).toEqual({
      name: 'AIGatewayError',
      message: 'Something failed',
      code: 'BAD_REQUEST',
      statusCode: 400,
      metadata: { requestId: 'req-1', path: '/api/v1/test' },
    });
  });

  it('works with JSON.stringify', () => {
    const err = new AuthError('Unauthorized', 401, { requestId: 'req-2' });
    const parsed = JSON.parse(JSON.stringify(err));
    expect(parsed.name).toBe('AuthError');
    expect(parsed.code).toBe('AUTH_REQUIRED');
    expect(parsed.statusCode).toBe(401);
    expect(parsed.metadata.requestId).toBe('req-2');
  });

  it('includes subclass name', () => {
    const err = new CreditsError('No credits', 402, 'INSUFFICIENT_CREDITS');
    expect(err.toJSON().name).toBe('CreditsError');
  });
});

describe('isAIGatewayError', () => {
  it('returns true for AIGatewayError', () => {
    expect(isAIGatewayError(new AIGatewayError('test', 'BAD_REQUEST', 400))).toBe(true);
  });

  it('returns true for subclasses', () => {
    expect(isAIGatewayError(new AuthError('test', 401))).toBe(true);
    expect(isAIGatewayError(new CreditsError('test', 402, 'INSUFFICIENT_CREDITS'))).toBe(true);
  });

  it('returns false for regular errors', () => {
    expect(isAIGatewayError(new Error('test'))).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(isAIGatewayError('string')).toBe(false);
    expect(isAIGatewayError(null)).toBe(false);
    expect(isAIGatewayError(undefined)).toBe(false);
  });
});
