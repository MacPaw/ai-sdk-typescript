import { createAIGatewayProvider, generateText, streamText } from '@macpaw/ai-sdk/provider';

const token = process.env.AI_GATEWAY_TOKEN ?? process.env.SETAPP_TOKEN;
const baseURL = process.env.AI_GATEWAY_BASE_URL;
const modelId = process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-4.1-nano';

if (!token) {
  console.error('Set AI_GATEWAY_TOKEN or SETAPP_TOKEN before running this example.');
  process.exit(1);
}

const gateway = createAIGatewayProvider({
  ...(baseURL ? { baseURL } : { env: 'production' }),
  getAuthToken: async () => token,
});

const generated = await generateText({
  model: gateway(modelId),
  prompt: 'Say hello from the provider example in one sentence.',
});

console.log('generateText():', generated.text);

const streamed = streamText({
  model: gateway(modelId),
  prompt: 'Stream a very short greeting.',
});

let streamedText = '';
for await (const delta of streamed.textStream) {
  process.stdout.write(delta);
  streamedText += delta;
}

console.log(`\nstreamText() complete: ${streamedText}`);
