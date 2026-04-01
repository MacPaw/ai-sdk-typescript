import { Module } from '@nestjs/common';
import { AIGatewayModule } from '@macpaw/ai-sdk/nestjs';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

const token = process.env.AI_GATEWAY_TOKEN ?? process.env.SETAPP_TOKEN;

if (!token) {
  throw new Error('Set AI_GATEWAY_TOKEN or SETAPP_TOKEN before starting the NestJS example.');
}

@Module({
  imports: [
    AIGatewayModule.forRoot({
      ...(process.env.AI_GATEWAY_BASE_URL ? { baseURL: process.env.AI_GATEWAY_BASE_URL } : { env: 'production' }),
      getAuthToken: async () => token,
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class AppModule {}
