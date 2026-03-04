import { describe, it, expect, vi } from 'vitest';
import { AIGatewayExceptionFilter } from './ai-gateway.filter';
import { AIGatewayError, AuthError, RateLimitError, CreditsError } from '../core/errors';
import { ErrorCode } from '../core/types';

function createMockHost(mockResponse: Record<string, ReturnType<typeof vi.fn>>) {
  return {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => ({}),
    }),
  } as any;
}

describe('AIGatewayExceptionFilter', () => {
  const filter = new AIGatewayExceptionFilter();

  it('returns structured error for AuthError', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const header = vi.fn();
    const host = createMockHost({ status, json, header });

    const error = new AuthError('Token expired', 401, { requestId: 'req-123' });
    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      statusCode: 401,
      error: ErrorCode.AuthRequired,
      message: 'Token expired',
      requestId: 'req-123',
    });
  });

  it('returns structured error for RateLimitError with retryAfter and Retry-After header', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const header = vi.fn();
    const host = createMockHost({ status, json, header });

    const error = new RateLimitError('Too many requests', 429, { retryAfter: 30 });
    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(429);
    expect(header).toHaveBeenCalledWith('Retry-After', '30');
    expect(json).toHaveBeenCalledWith({
      statusCode: 429,
      error: ErrorCode.RateLimited,
      message: 'Too many requests',
      retryAfter: 30,
    });
  });

  it('returns structured error for CreditsError with paymentUrl', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const header = vi.fn();
    const host = createMockHost({ status, json, header });

    const error = new CreditsError('No credits', 402, ErrorCode.InsufficientCredits, {
      paymentUrl: 'https://pay.example.com',
    });
    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(402);
    expect(json).toHaveBeenCalledWith({
      statusCode: 402,
      error: ErrorCode.InsufficientCredits,
      message: 'No credits',
      paymentUrl: 'https://pay.example.com',
    });
  });

  it('maps unknown status codes to 502', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const header = vi.fn();
    const host = createMockHost({ status, json, header });

    const error = new AIGatewayError('Unknown', ErrorCode.InternalServerError, 0);
    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(502);
  });

  it('preserves valid 4xx/5xx status codes', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const header = vi.fn();
    const host = createMockHost({ status, json, header });

    const error = new AIGatewayError('Forbidden', ErrorCode.Forbidden, 403);
    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(403);
  });

  it('omits optional fields when metadata is empty', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const header = vi.fn();
    const host = createMockHost({ status, json, header });

    const error = new AIGatewayError('Bad request', ErrorCode.BadRequest, 400);
    filter.catch(error, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: ErrorCode.BadRequest,
      message: 'Bad request',
    });
    expect(header).not.toHaveBeenCalled();
  });
});
