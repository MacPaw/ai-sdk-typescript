# Integration guide

How `@macpaw/ai-sdk` is split across entry points and how to import the pieces you need. The package is built as a **Vercel AI SDK extension** for AI Gateway: core generation APIs stay on upstream `ai` / `@ai-sdk/*`; MacPaw-owned surfaces live under the subpaths below.

## Package layout

- **`@macpaw/ai-sdk/provider`** — primary app surface: gateway provider factories, gateway fetch helpers, MacPaw error types.
- **`@macpaw/ai-sdk/client`** — typed HTTP client for Gateway endpoints (including multipart).
- **`@macpaw/ai-sdk/runtime`** — transport, config resolution, validation, retry, SSE, and request-pipeline primitives.
- **`@macpaw/ai-sdk/types`** — domain request/response TypeScript types.
- **`@macpaw/ai-sdk`** — convenience root: same provider-oriented exports as `./provider`, plus shared errors, enums, and stream helpers.
- **`@macpaw/ai-sdk/nestjs`**, **`@macpaw/ai-sdk/testing`** — NestJS module and test utilities.

Upstream **`ai`**, **`@ai-sdk/openai`**, **`@ai-sdk/react`** (or **`ai/react`**) stay the home for Vercel AI SDK primitives and React hooks.

## Choose an entry point

| Goal | Import from |
| ---- | ----------- |
| Gateway-backed `LanguageModel` for `generateText` / `streamText` | `@macpaw/ai-sdk/provider` |
| Shared MacPaw helpers, errors, stream utilities | `@macpaw/ai-sdk` |
| Direct Gateway HTTP calls or multipart APIs | `@macpaw/ai-sdk/client` |
| Low-level transport, validation, retry, SSE | `@macpaw/ai-sdk/runtime` |
| React hooks (`useChat`, …) | `@ai-sdk/react` or `ai/react` |

Keep `generateText`, `streamText`, tools, agents, and UI streams on upstream `ai` where possible; add `@macpaw/ai-sdk/provider` for gateway-aware model construction. Use `client` when you need raw HTTP or multipart, not as a replacement for the Vercel core APIs.

## Common import paths

| You need | Typical import |
| -------- | -------------- |
| `generateText`, `streamText`, `customProvider`, … | `from 'ai'` |
| `createOpenAI`, … | `from '@ai-sdk/openai'` |
| `createAIGatewayProvider`, `createGatewayProvider`, … | `from '@macpaw/ai-sdk/provider'` |
| `createAIGatewayClient` | `from '@macpaw/ai-sdk/client'` |
| `API_PATHS`, `createFetchTransport`, `SDKValidationError`, … | `from '@macpaw/ai-sdk/runtime'` |
| Chat/embeddings/audio types | `from '@macpaw/ai-sdk/types'` |

## Low-level HTTP client

```ts
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';
```

## Domain types

```ts
import type { ChatCompletion, CreateChatCompletionRequest } from '@macpaw/ai-sdk/types';
```

## Vercel AI SDK + Gateway provider

```ts
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAIGatewayProvider } from '@macpaw/ai-sdk/provider';
```

Model construction with Gateway:

```ts
const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken: async () => (await getSetappSession()).accessToken,
});

await generateText({
  model: gateway('openai/gpt-4.1-mini'),
  prompt: 'Hello',
});
```

## Advanced runtime utilities

```ts
import { API_PATHS, createFetchTransport, SDKValidationError } from '@macpaw/ai-sdk/runtime';
```

## Root package `@macpaw/ai-sdk`

The root entry re-exports the same MacPaw provider-oriented surface as `@macpaw/ai-sdk/provider`, plus shared items such as `AIGatewayError`, `ErrorCode`, `SDKValidationError`, and stream helpers.

Use **`@macpaw/ai-sdk/client`** for `createAIGatewayClient` and **`@macpaw/ai-sdk/runtime`** for pipeline internals such as `createFetchTransport`.

## Integration checklist

1. Keep `generateText`, `streamText`, tools, agents, and stream handling on upstream `ai`.
2. Keep direct OpenAI-compatible factories on `@ai-sdk/openai` (or other `@ai-sdk/*`) when you need them.
3. Build gateway model handles with `createAIGatewayProvider(...)` or `createGatewayProvider(...)`.
4. Import `createAIGatewayClient` from `@macpaw/ai-sdk/client` when you need the HTTP client.
5. Import runtime primitives from `@macpaw/ai-sdk/runtime` when you extend or debug the pipeline.
6. Import domain types from `@macpaw/ai-sdk/types`.
7. Import React hooks from `@ai-sdk/react` or `ai/react`.
8. For Anthropic, Google, etc., keep upstream `@ai-sdk/*` packages in the app and use `createGatewayProvider(...)` from `@macpaw/ai-sdk/provider` for Gateway-routed models where applicable.

## Example: Vercel-style app plus multipart

```ts
import { generateText } from 'ai';
import { createAIGatewayProvider } from '@macpaw/ai-sdk/provider';
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';

const getAuthToken = async () => (await getSetappSession()).accessToken;

const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken,
});

const client = createAIGatewayClient({
  env: 'production',
  getAuthToken,
});

await generateText({
  model: gateway('openai/gpt-4.1-mini'),
  prompt: 'Draft a caption',
});

await client.images.edit({
  model: 'openai/dall-e-2',
  image: imageFile,
  prompt: 'Add a blue background',
});
```
