import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import { AIGatewayError } from '../core/errors';

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
    const body = {
      statusCode: status,
      error: exception.code,
      message: exception.message,
      ...(exception.metadata?.retryAfter != null && { retryAfter: exception.metadata.retryAfter }),
    };

    if (typeof response.status === 'function' && typeof response.json === 'function') {
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
