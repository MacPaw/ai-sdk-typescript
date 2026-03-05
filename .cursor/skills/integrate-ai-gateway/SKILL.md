---
name: integrate-ai-gateway
description: Integrate applications with AI Gateway using the @macpaw/ai SDK. Use when the user wants to add AI Gateway, MacPaw AI, Setapp AI, chat completions, embeddings, images, or audio via Gateway, or mentions createAIGatewayClient, createAIGatewayProvider, NestJS AI module, or Vercel AI SDK with AI Gateway.
---

# AI Gateway Integration (@macpaw/ai)

## Step 1 — Detect project stack and choose path

Scan the project for framework markers before writing any code:

| Marker | Integration path |
|--------|-----------------|
| `@nestjs/common` in deps, or `*.module.ts` files | **NestJS** → `AIGatewayModule` from `@macpaw/ai/nestjs` |
| `next`, `@ai-sdk/*`, or `ai` in deps | **Vercel AI SDK** → `createAIGatewayProvider` from `@macpaw/ai/provider` |
| `express`, `fastify`, `hono`, or plain Node/TS | **Node client** → `createAIGatewayClient` from `@macpaw/ai` |
| Browser/SPA (`vite`, `webpack`, no server framework) | **Browser client** → same `createAIGatewayClient` from `@macpaw/ai` |

Always install: `pnpm add @macpaw/ai` (or npm/yarn). No other AI packages needed.

## Step 2 — Implement

### NestJS

```ts
// app.module.ts
import { AIGatewayModule } from '@macpaw/ai/nestjs';

AIGatewayModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    env: 'production',
    getAuthToken: async () => config.get('SETAPP_TOKEN')!,
  }),
  inject: [ConfigService],
})

// service.ts — inject with decorator
import { InjectAIGateway } from '@macpaw/ai/nestjs';
import type { AIGatewayClient } from '@macpaw/ai';

constructor(@InjectAIGateway() private readonly ai: AIGatewayClient) {}

// controller.ts — add exception filter
import { AIGatewayExceptionFilter } from '@macpaw/ai/nestjs';
@UseFilters(AIGatewayExceptionFilter)
```

### Vercel AI SDK / Next.js

```ts
import { createAIGatewayProvider, generateText, streamText } from '@macpaw/ai/provider';

const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken: async () => (await getSession()).accessToken,
});

// Use gateway('model-name') as model in generateText / streamText / useChat
```

### Node / Express / Browser

```ts
import { createAIGatewayClient } from '@macpaw/ai';

const client = createAIGatewayClient({
  env: 'production',
  getAuthToken: async () => token,
});

// client.chat.completions.create({...})   — non-streaming
// client.chat.completions.stream({...})   — returns .textStream, .text, .abort()
// client.responses.create / .stream       — OpenAI Responses API
// client.embeddings.create                — embeddings
// client.images.generate / .edit          — images
// client.audio.transcriptions.create      — audio
// client.models.list                      — list models
```

## Step 3 — Error handling

Always wrap calls with `AIGatewayError` handling:

```ts
import { AIGatewayError, ErrorCode } from '@macpaw/ai';

try { /* ... */ } catch (e) {
  if (e instanceof AIGatewayError) {
    // e.code — ErrorCode enum (AUTH_REQUIRED, INSUFFICIENT_CREDITS, RATE_LIMITED, ...)
    // e.paymentUrl — redirect for payment (402)
    // e.retryAfter — seconds to wait (429)
    // e.requestId — for support
  }
}
```

For NestJS: `AIGatewayExceptionFilter` handles this automatically.

## Step 4 — Testing

```ts
import { createMockAIGatewayClient, createMockChatCompletion } from '@macpaw/ai/testing';

const mock = createMockAIGatewayClient();
mock.chat.completions.create.mockResolvedValue(
  createMockChatCompletion({ content: 'Mock' }),
);
```

NestJS: provide `AI_GATEWAY_CLIENT` token with `createMockAIGatewayClient()`.

## Common mistakes (avoid these)

- **Wrong:** `import { createOpenAI } from '@ai-sdk/openai'` — use `createAIGatewayProvider` from `@macpaw/ai/provider` instead; it handles auth and URL routing.
- **Wrong:** `import { generateText } from 'ai'` — use `import { generateText } from '@macpaw/ai/provider'`; same function, re-exported for convenience.
- **Wrong:** `env: 'staging'` — only `'production'` is valid. For non-production, use `baseURL: 'https://...'`.
- **Wrong:** hardcoding tokens — always use `getAuthToken` async function.
- **Wrong:** `new AuthError('msg', 401, 'AUTH_REQUIRED')` — third arg is metadata object, not string: `new AuthError('msg', 401)` or `new AuthError('msg', 401, { requestId: '...' })`.
- **Wrong:** `retry: { maxRetries: 3 }` — the field is `maxAttempts`, not `maxRetries`.
