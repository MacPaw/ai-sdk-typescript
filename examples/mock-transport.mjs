import { createAIGatewayClient } from '@macpaw/ai-sdk/client';
import { createMockTransport } from '@macpaw/ai-sdk/testing';

const transport = createMockTransport();

const client = createAIGatewayClient({
  baseURL: 'https://api.example.com/ai',
  getAuthToken: async () => 'demo-token',
  transport,
  middleware: [
    async (config, next) =>
      next({
        ...config,
        headers: {
          ...config.headers,
          'X-Demo-Source': 'mock-transport-example',
        },
      }),
  ],
});

const completion = await client.chat.completions.create({
  model: 'openai/gpt-4.1-nano',
  messages: [{ role: 'user', content: 'Say hello from the mock transport demo.' }],
});

console.log('Chat completion:', completion.choices[0]?.message?.content);
console.log('Captured requests:', transport.requestCount);
console.log('First request body:', transport.requests[0]?.body);

const streamed = client.responses.stream({
  model: 'openai/gpt-4.1-nano',
  input: 'Stream a short sentence.',
});

let streamedText = '';
for await (const delta of streamed.textStream) {
  streamedText += delta;
}

console.log('Streamed text:', streamedText);
