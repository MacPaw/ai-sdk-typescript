import { Injectable } from '@nestjs/common';
import { InjectAIGateway } from '@macpaw/ai-sdk/nestjs';
import { createAIGatewayProvider } from '@macpaw/ai-sdk';
import type { GatewayProviderSettings } from '@macpaw/ai-sdk';
import { generateText } from 'ai';

@Injectable()
export class ChatService {
  constructor(@InjectAIGateway() private readonly config: GatewayProviderSettings) {}

  async complete(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
    const provider = createAIGatewayProvider(this.config);
    const { text } = await generateText({
      model: provider(process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-4.1-nano'),
      messages,
    });
    return text;
  }
}
