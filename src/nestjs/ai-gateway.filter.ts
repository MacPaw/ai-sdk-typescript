import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import { AIGatewayError } from '../runtime/errors';

/**
 * NestJS exception filter that catches `AIGatewayError` and returns a structured HTTP response.
 *
 * Attach globally, per controller, or per route:
 *
 * @example
 * ```ts
 * // Global
 * app.useGlobalFilters(new AIGatewayExceptionFilter());
 *
 * // Per controller
 * @UseFilters(AIGatewayExceptionFilter)
 * @Controller('chat')
 * export class ChatController {}
 * ```
 */
@Catch(AIGatewayError)
export class AIGatewayExceptionFilter implements ExceptionFilter {
  catch(exception: AIGatewayError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status = this.mapStatusCode(exception.statusCode);
    const body: Record<string, unknown> = {
      statusCode: status,
      error: exception.code,
      message: exception.message,
    };

    if (exception.metadata?.requestId != null) body.requestId = exception.metadata.requestId;
    if (exception.metadata?.paymentUrl != null) body.paymentUrl = exception.metadata.paymentUrl;
    if (exception.metadata?.retryAfter != null) body.retryAfter = exception.metadata.retryAfter;

    if (typeof response.status === 'function' && typeof response.json === 'function') {
      if (exception.metadata?.retryAfter != null && typeof response.header === 'function') {
        response.header('Retry-After', String(exception.metadata.retryAfter));
      }
      response.status(status).json(body);
    } else {
      throw new HttpException(body, status);
    }
  }

  private mapStatusCode(sdkStatus: number): number {
    if (sdkStatus >= 400 && sdkStatus < 600) return sdkStatus;
    return HttpStatus.BAD_GATEWAY;
  }
}
