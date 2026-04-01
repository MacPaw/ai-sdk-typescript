import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { AIGatewayExceptionFilter } from '@macpaw/ai-sdk/nestjs';
import { ChatService } from './chat.service';

interface ChatBody {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

@Controller('chat')
@UseFilters(AIGatewayExceptionFilter)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async create(@Body() body: ChatBody) {
    return this.chatService.complete(body.messages);
  }
}
