import { createAIGatewayClient } from '@macpaw/ai-sdk/client';

const token = process.env.AI_GATEWAY_TOKEN ?? process.env.SETAPP_TOKEN;
const baseURL = process.env.AI_GATEWAY_BASE_URL;
const model = process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-4.1-nano';

if (!token) {
  console.error('Set AI_GATEWAY_TOKEN or SETAPP_TOKEN before running this example.');
  process.exit(1);
}

const client = createAIGatewayClient({
  ...(baseURL ? { baseURL } : { env: 'production' }),
  getAuthToken: async () => token,
});

const completion = await client.chat.completions.create({
  model,
  messages: [{ role: 'user', content: 'Give me a one-sentence SDK hello.' }],
});

console.log('Model:', completion.model);
console.log('Assistant:', completion.choices[0]?.message?.content);
