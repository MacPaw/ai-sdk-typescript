---
name: integrate-ai-gateway
description: Integrate applications with AI Gateway using the @macpaw/ai-sdk SDK in a mostly automatic workflow. Use when working in Cursor/Claude Code and the user asks to add AI Gateway, MacPaw AI, Setapp AI, chat/embeddings/images/audio, or mentions createAIGatewayClient, createAIGatewayProvider, NestJS AI module, or Vercel AI SDK with AI Gateway.
---

# AI Gateway Integration (@macpaw/ai-sdk)

## Goal

Implement AI Gateway integration in "auto mode":

1. Detect stack.
2. Make the minimal correct code changes.
3. Add safe error handling.
4. Add a small smoke test/example.
5. Run verification commands.
6. Report exactly what changed.

Do not ask unnecessary questions. Ask only when there is a real ambiguity.

## Step 0 — Skip if already integrated

If `@macpaw/ai-sdk` is in package.json and the integration is present (e.g. `AIGatewayModule` in imports, `createAIGatewayProvider` used, or `createAIGatewayClient` instantiated), skip. Only ask if the user explicitly wants to re-integrate or fix the setup.

If the codebase uses `openai`, `@ai-sdk/openai`, or `@anthropic-ai/sdk` directly, treat this as a **migration** — go to the "Migration" section below.

## Step 1 — Detect stack before coding

Scan `package.json` and source files, then choose exactly one primary path:

| Marker                                           | Primary integration path                                   |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `@nestjs/common` deps, `*.module.ts`, decorators | **NestJS** (Node.js + Nest) with `@macpaw/ai-sdk/nestjs`   |
| `next`, `@ai-sdk/*`, `ai` patterns               | **Vercel AI SDK / Next.js** with `@macpaw/ai-sdk/provider` |
| `express`, `fastify`, `hono`, server scripts     | **Node server** with `@macpaw/ai-sdk/client`               |
| Vite/Webpack SPA with no backend                 | **Browser client** with `@macpaw/ai-sdk/client`            |

If two paths are equally plausible, ask one concise clarification question and continue.

Always install `@macpaw/ai-sdk` via the project's package manager. No additional AI SDK packages are required.

## Step 2 — Apply stack-specific integration

### NestJS

Use:

- `AIGatewayModule.forRootAsync(...)` in `AppModule` imports
- `@InjectAIGateway()` in services
- `AIGatewayExceptionFilter` for controllers/routes

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { AIGatewayModule } from '@macpaw/ai-sdk/nestjs';

@Module({
  imports: [
    AIGatewayModule.forRootAsync({
      useFactory: () => ({
        env: 'production',
        getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
      }),
    }),
  ],
})
export class AppModule {}

// chat.service.ts — full usage example
import { Injectable } from '@nestjs/common';
import { InjectAIGateway } from '@macpaw/ai-sdk/nestjs';
import type { AIGatewayClient } from '@macpaw/ai-sdk/client';

@Injectable()
export class ChatService {
  constructor(@InjectAIGateway() private readonly ai: AIGatewayClient) {}

  async complete(prompt: string): Promise<string> {
    const response = await this.ai.chat.completions.create({
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content ?? '';
  }
}

// chat.controller.ts — attach the exception filter
import { Controller, Post, Body, UseFilters } from '@nestjs/common';
import { AIGatewayExceptionFilter } from '@macpaw/ai-sdk/nestjs';

@Controller('chat')
@UseFilters(AIGatewayExceptionFilter)
export class ChatController {
  /* ... */
}
```

### Vercel AI SDK / Next.js

Use `@macpaw/ai-sdk/provider` for provider + generation functions. Never import from `@ai-sdk/openai` directly. React hooks (`useChat`, `useCompletion`) stay as `ai/react`.

```ts
// lib/ai.ts — shared provider instance
import { createAIGatewayProvider } from '@macpaw/ai-sdk/provider';

export const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});

// app/api/chat/route.ts — streaming API route
import { streamText } from '@macpaw/ai-sdk/provider';
import { gateway } from '@/lib/ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: gateway('openai/gpt-4o'),
    messages,
  });
  return result.toDataStreamResponse();
}

// components/chat.tsx — useChat with API route above
('use client');
import { useChat } from 'ai/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  // useChat calls /api/chat by default — which uses gateway via @macpaw/ai-sdk/provider
}
```

> Note: `useChat` is imported from `ai/react` (Vercel AI SDK React hooks), not from `@macpaw/ai-sdk/provider`. The provider only handles the server-side model + auth configuration.

**Dual backend (gateway vs direct OpenAI)** — keep `generateText` / `streamText` unchanged; pick the model factory from config (env flag, build flavor, etc.):

```ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAIGatewayProvider } from '@macpaw/ai-sdk/provider';

const useGateway = process.env.MY_APP_USE_AI_GATEWAY === '1';
const gateway = createAIGatewayProvider({ env: 'production', getAuthToken: async () => sessionToken });
const direct = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export function languageModel(id: string) {
  return useGateway ? gateway(id) : direct(id);
}
```

Use `createAIGatewayClient` from `@macpaw/ai-sdk/client` for multipart-heavy APIs (image edits, audio) when the provider path is not enough. Prefer domain types from `@macpaw/ai-sdk/types`.

### Node / Express / Browser

```ts
// lib/ai.ts — shared singleton
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';

export const ai = createAIGatewayClient({
  env: 'production',
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});

// usage
const response = await ai.chat.completions.create({
  model: 'openai/gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

Prefer a single shared client factory per app and reuse it.

### Staging / Custom host

Use `baseURL` instead of `env`:

```ts
createAIGatewayClient({
  baseURL: 'https://ai-gateway.staging.example.com',
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});
```

## Step 2a — Non-chat endpoints

### Embeddings

```ts
const result = await ai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Hello world',
});
```

### Images

```ts
const result = await ai.images.generate({
  model: 'dall-e-3',
  prompt: 'A cat in space',
  size: '1024x1024',
});
```

### Audio (transcription)

```ts
const result = await ai.audio.transcriptions.create({
  model: 'whisper-1',
  file: audioFile, // File | Blob
});
```

### Responses API

```ts
const result = await ai.responses.create({
  model: 'openai/gpt-4o',
  input: 'Summarize the latest news',
});

// Streaming
const stream = ai.responses.stream({
  model: 'openai/gpt-4o',
  input: 'Write a poem',
});
for await (const delta of stream.textStream) {
  process.stdout.write(delta);
}
```

## Step 3 — Add robust error handling

For direct SDK calls, handle `AIGatewayError` explicitly:

```ts
import { AIGatewayError, ErrorCode } from '@macpaw/ai-sdk';

try {
  // gateway call
} catch (error) {
  if (error instanceof AIGatewayError) {
    switch (error.code) {
      case ErrorCode.PaymentRequired:
        // redirect user to error.paymentUrl
        break;
      case ErrorCode.RateLimited:
        // wait error.retryAfter seconds
        break;
      default:
      // log error.requestId for support
    }
  }
  throw error;
}
```

For NestJS, prefer `AIGatewayExceptionFilter` to avoid duplicated try/catch.

## Step 4 — Update env files

Add the token variable to `.env.example` (or `.env.local` for Next.js) if it exists:

```
AI_GATEWAY_TOKEN=your_token_here
```

Never commit real token values. If `.env` is tracked in git (not in `.gitignore`), warn the user.

## Step 5 — Add test or smoke example

If test setup exists, add/update a focused test using `@macpaw/ai-sdk/testing`.
If not, add a minimal smoke example in the nearest existing examples/scripts area.

```ts
import { createMockAIGatewayClient, createMockChatCompletion } from '@macpaw/ai-sdk/testing';

const mock = createMockAIGatewayClient();
mock.chat.completions.create.mockResolvedValue(createMockChatCompletion({ content: 'Mock response' }));
```

## Step 6 — Verify and report

After edits, run the project's available verification commands (prefer this order):

1. Typecheck
2. Lint
3. Tests (targeted first, full suite if reasonable)

Then report:

- Files changed
- Why each change was needed
- Verification status
- Any remaining manual steps (e.g. set `AI_GATEWAY_TOKEN` env var)

## Migration from OpenAI / Vercel AI SDK

When the codebase already uses `openai`, `@ai-sdk/openai`, or imports from `ai`:

| Before                                    | After                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `import OpenAI from 'openai'`             | `import { createAIGatewayClient } from '@macpaw/ai-sdk/client'`       |
| `new OpenAI({ apiKey })`                  | `createAIGatewayClient({ env: 'production', getAuthToken })`          |
| `import { openai } from '@ai-sdk/openai'` | `createAIGatewayProvider(...)` from `@macpaw/ai-sdk/provider`         |
| `import { generateText } from 'ai'`       | `import { generateText } from '@macpaw/ai-sdk/ai'` (or `…/provider`)  |
| `import { streamText } from 'ai'`         | `import { streamText } from '@macpaw/ai-sdk/ai'` (or `…/provider`)    |
| `from 'ai/internal'` / `from 'ai/test'`   | `from '@macpaw/ai-sdk/ai/internal'` / `from '@macpaw/ai-sdk/ai/test'` |
| `import { useChat } from 'ai/react'`      | Keep as-is — `useChat` is a React hook, not re-exported by provider   |

After migration, remove `openai`, `@ai-sdk/openai` from `package.json` unless they are used elsewhere.

## Rules to enforce

- Use `getAuthToken: async () => tokenOrNull` for auth.
- `env` supports only `'production'`; use `baseURL` for staging/custom hosts.
- Do not hardcode secrets or tokens.
- Prefer imports from `@macpaw/ai-sdk`, `@macpaw/ai-sdk/client`, `@macpaw/ai-sdk/provider`, `@macpaw/ai-sdk/react`, `@macpaw/ai-sdk/nestjs`, `@macpaw/ai-sdk/testing`, and `@macpaw/ai-sdk/<provider>` for any Vercel provider package you use (anthropic, google, xai, groq, mistral, amazon-bedrock, azure, cohere, perplexity, deepseek, togetherai, openai-compatible — each mirrors `@ai-sdk/<name>`).
- For retries, use `maxAttempts` (not `maxRetries`).
- Never import generation helpers from `ai` directly — use `@macpaw/ai-sdk/provider`. Exception: `useChat` / `useCompletion` from `@macpaw/ai-sdk/react`, `ai/react`, or `@ai-sdk/react`. For a dual-backend toggle, `createOpenAI` from `@ai-sdk/openai` is allowed only for the non-gateway branch next to `createAIGatewayProvider`.

## Common mistakes to auto-fix

- Replace direct gateway-bound OpenAI usage with `createAIGatewayProvider` (keep `createOpenAI` only when intentionally supporting a non-gateway branch).
- Replace `generateText` / `streamText` imports from `ai` with `@macpaw/ai-sdk/provider`. Keep `useChat`/`useCompletion` from `@macpaw/ai-sdk/react` or `ai/react`.
- Replace `env: 'staging'` with `baseURL`.
- Replace token literals with `getAuthToken`.
- Normalize retry option names to `maxAttempts`.

## Interaction style in auto mode

- Be decisive and patch files directly.
- Ask questions only when blocked by ambiguity.
- Keep changes minimal and idiomatic for that codebase.
- Preserve existing architecture and coding style.
