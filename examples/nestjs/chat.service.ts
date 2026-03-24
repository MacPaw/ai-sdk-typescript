import { Injectable } from '@nestjs/common';
import { InjectAIGateway } from '@macpaw/ai-sdk/nestjs';
import type { AIGatewayClient } from '@macpaw/ai-sdk/client';

@Injectable()
export class ChatService {
  constructor(@InjectAIGateway() private readonly ai: AIGatewayClient) {}

  async complete(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
    return this.ai.chat.completions.create({
      model: process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-4.1-nano',
      messages,
    });
  }
}
