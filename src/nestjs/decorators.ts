import { Inject } from '@nestjs/common';
import { AI_GATEWAY_CLIENT } from './constants';

/**
 * Injects the configured `AIGatewayClient` into a constructor parameter or property.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class ChatService {
 *   constructor(@InjectAIGateway() private readonly ai: AIGatewayClient) {}
 * }
 * ```
 */
export const InjectAIGateway = (): ParameterDecorator & PropertyDecorator => Inject(AI_GATEWAY_CLIENT);
