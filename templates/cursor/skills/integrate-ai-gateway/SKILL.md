---
name: integrate-ai-gateway
description: Integrate applications with AI Gateway using the @macpaw/ai-sdk SDK in a mostly automatic workflow. Use when working in Cursor/Claude Code and the user asks to add AI Gateway, MacPaw AI, Setapp AI, chat/embeddings/images/audio, or mentions createAIGatewayProvider, createGatewayFetch, NestJS AI module, or Vercel AI SDK with AI Gateway.
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

If `@macpaw/ai-sdk` is in package.json and the integration is present (e.g. `AIGatewayModule` in imports, `createAIGatewayProvider` or `createGatewayFetch` used), skip. Only ask if the user explicitly wants to re-integrate or fix the setup.

If the codebase uses `openai`, `@ai-sdk/openai`, or `@anthropic-ai/sdk` directly, treat this as a **migration** — go to the "Migration" section below.

## Package surface (current)

- **`@macpaw/ai-sdk`** — canonical: `createAIGatewayProvider`, `createGatewayProvider`, `createGatewayFetch`, `GATEWAY_PROVIDERS`, errors, `GatewayProviderSettings`.
- **`@macpaw/ai-sdk/provider`** — same as root (compatibility alias in `package.json` exports).
- **`@macpaw/ai-sdk/nestjs`** — NestJS module + filter + `@InjectAIGateway()`.

There is **no** `createAIGatewayClient`, `@macpaw/ai-sdk/client`, `@macpaw/ai-sdk/runtime`, `@macpaw/ai-sdk/types`, or `@macpaw/ai-sdk/testing`. For raw HTTP (including multipart), use **`createGatewayFetch`** + `fetch`. For chat/embeddings through Vercel stack, use **`ai`** + gateway provider.

## Step 1 — Detect stack before coding

Scan `package.json` and source files, then choose exactly one primary path:

| Marker                                           | Primary integration path                                   |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `@nestjs/common` deps, `*.module.ts`, decorators | **NestJS** with `@macpaw/ai-sdk/nestjs` + `@macpaw/ai-sdk` |
| `next`, `@ai-sdk/*`, `ai` patterns               | **Vercel AI SDK / Next.js** with `@macpaw/ai-sdk`          |
| `express`, `fastify`, `hono`, server scripts     | **`createGatewayFetch`** + `fetch`, or `ai` + provider     |
| Vite/Webpack SPA with no backend                 | Same as server — token must come from your BFF             |

If two paths are equally plausible, ask one concise clarification question and continue.

Install `@macpaw/ai-sdk` and, when using Vercel APIs, `ai` / `@ai-sdk/openai` as needed.

## Step 2 — Apply stack-specific integration

### NestJS

Use:

- `AIGatewayModule.forRoot` / `forRootAsync` in `AppModule` imports
- `@InjectAIGateway()` injects **`GatewayProviderSettings`** (not an HTTP client)
- `AIGatewayExceptionFilter` on controllers/routes

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

// chat.service.ts
import { Injectable } from '@nestjs/common';
import { InjectAIGateway } from '@macpaw/ai-sdk/nestjs';
import type { GatewayProviderSettings } from '@macpaw/ai-sdk';
import { createAIGatewayProvider } from '@macpaw/ai-sdk';
import { generateText } from 'ai';

@Injectable()
export class ChatService {
  constructor(@InjectAIGateway() private readonly config: GatewayProviderSettings) {}

  async complete(prompt: string): Promise<string> {
    const gateway = createAIGatewayProvider(this.config);
    const { text } = await generateText({
      model: gateway('openai/gpt-4o'),
      prompt,
    });
    return text;
  }
}

// chat.controller.ts
import { Controller, UseFilters } from '@nestjs/common';
import { AIGatewayExceptionFilter } from '@macpaw/ai-sdk/nestjs';

@Controller('chat')
@UseFilters(AIGatewayExceptionFilter)
export class ChatController {
  /* ... */
}
```

### Vercel AI SDK / Next.js

Use upstream `ai` for generation and **`@macpaw/ai-sdk`** for the gateway provider. React hooks (`useChat`, …) stay on `ai/react` or `@ai-sdk/react`.

```ts
// lib/ai.ts
import { createAIGatewayProvider } from '@macpaw/ai-sdk';

export const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});

// app/api/chat/route.ts
import { streamText } from 'ai';
import { gateway } from '@/lib/ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: gateway('openai/gpt-4o'),
    messages,
  });
  return result.toDataStreamResponse();
}
```

**Dual backend (gateway vs direct OpenAI):**

```ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAIGatewayProvider } from '@macpaw/ai-sdk';

const useGateway = process.env.MY_APP_USE_AI_GATEWAY === '1';
const gateway = createAIGatewayProvider({ env: 'production', getAuthToken: async () => sessionToken });
const direct = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export function languageModel(id: string) {
  return useGateway ? gateway(id) : direct(id);
}
```

**Multipart (image edit, audio upload):** `createGatewayFetch` with `FormData` body — see README “createGatewayFetch”.

### Raw Node / Express

```ts
import { createGatewayFetch } from '@macpaw/ai-sdk';

const gatewayFetch = createGatewayFetch({
  baseURL: 'https://api.macpaw.com/ai',
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});

const res = await gatewayFetch('/api/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'openai/gpt-4o',
    messages: [{ role: 'user', content: 'Hello' }],
  }),
});
const data = await res.json();
```

Resolve `baseURL` via `env: 'production'` inside a small helper if you prefer the default MacPaw URL (see `resolveGatewayBaseURL` usage in `createAIGatewayProvider` pattern).

### Staging / custom host

Use `baseURL` instead of `env`:

```ts
createAIGatewayProvider({
  baseURL: 'https://ai-gateway.staging.example.com/ai',
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});
```

## Step 2a — Non-chat via Vercel `ai`

Use `embed`, `generateImage`, etc. from **`ai`** with a model handle from `createAIGatewayProvider` / `createGatewayProvider` when the gateway exposes OpenAI-compatible routes. Otherwise use **`createGatewayFetch`** against the documented path (see repo `COMPATIBILITY.md` and `tmp/docs`).

## Step 3 — Add robust error handling

```ts
import { AIGatewayError, ErrorCode, isAIGatewayError } from '@macpaw/ai-sdk';

try {
  // ...
} catch (error) {
  if (isAIGatewayError(error)) {
    switch (error.code) {
      case ErrorCode.InsufficientCredits:
        // error.metadata.paymentUrl
        break;
      case ErrorCode.RateLimited:
        // error.retryAfter (seconds)
        break;
      default:
        // error.requestId
        break;
    }
  }
  throw error;
}
```

For NestJS, prefer `AIGatewayExceptionFilter`.

> Note: there is no `ErrorCode.PaymentRequired` in this SDK — use `InsufficientCredits` / `SubscriptionExpired`.

## Step 4 — Update env files

Add to `.env.example` / `.env.local` when applicable:

```
AI_GATEWAY_TOKEN=your_token_here
```

Never commit real tokens.

## Step 5 — Tests / smoke

There is no `@macpaw/ai-sdk/testing` package. Prefer:

- Mock `global.fetch` or pass `fetch: mockFetch` in config if exposed, or
- Mock `getAuthToken`, or
- Integration test against a stub HTTP server.

## Step 6 — Verify and report

Run typecheck, lint, tests. Report files changed, verification status, and manual steps (e.g. set `AI_GATEWAY_TOKEN`).

## Migration from OpenAI / raw HTTP

| Before                                    | After                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `import OpenAI from 'openai'`             | `createGatewayFetch` + `fetch`, or Vercel `ai` + `createAIGatewayProvider` |
| `import { openai } from '@ai-sdk/openai'` | Keep for non-gateway; use `createAIGatewayProvider` for Gateway branch     |
| `generateText` / `streamText`             | Keep from `ai`; swap model handle only                                     |

Remove dependencies only if nothing else needs them.

## Rules to enforce

- Use `getAuthToken: async () => tokenOrNull` for auth.
- `env` supports only `'production'`; use `baseURL` for staging/custom hosts.
- Do not hardcode secrets.
- Prefer `@macpaw/ai-sdk` (or alias `@macpaw/ai-sdk/provider`) for MacPaw gateway helpers; keep Vercel primitives on `ai` / `@ai-sdk/*`.
- Retry config uses `maxAttempts` (see `RetryConfig` in `gateway-config.ts`).

## Common mistakes to auto-fix

- Replace `env: 'staging'` with `baseURL`.
- Replace token literals with `getAuthToken`.
- Replace Nest injections of a non-existent `AIGatewayClient` with `GatewayProviderSettings` + `createAIGatewayProvider`.
- Replace imports from `@macpaw/ai-sdk/client` / `runtime` / `types` / `testing` with root + `createGatewayFetch` or upstream `ai`.

## Interaction style in auto mode

- Be decisive and patch files directly.
- Ask questions only when blocked by ambiguity.
- Keep changes minimal and idiomatic for that codebase.
- Preserve existing architecture and coding style.
