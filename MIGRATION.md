# Migration Guide

## Breaking Changes in v2

### Removed Public APIs

| Symbol | Replacement |
|--------|-------------|
| `createAIGatewayDualProvider` | None — choose either gateway or direct provider at startup |
| `createAIGatewayCustomProvider` | Use `customProvider` from `ai` directly |
| `AIGatewayCustomProviderRegistry` | Removed |
| `AIGatewayDualProviderOptions` | Removed |
| `AIGatewayProviderSource` | Removed |
| `OpenAIProviderSource` | Removed |
| `Resolvable` | Removed |
| `@macpaw/ai-sdk/react` entry point | Import directly from `@ai-sdk/react` |

---

## Vercel-First major

This release reframes `@macpaw/ai-sdk` as an extension layer for Vercel AI SDK:

- `@macpaw/ai-sdk/provider` is now the primary app-developer entry point.
- `@macpaw/ai-sdk/client` is the explicit advanced path for direct Gateway HTTP usage.
- `@macpaw/ai-sdk/runtime` is the explicit home for advanced transport/config/request primitives.
- `@macpaw/ai-sdk` now exposes the same MacPaw-owned provider helpers as `@macpaw/ai-sdk/provider`, while upstream `ai` / `@ai-sdk/*` keep ownership of Vercel AI SDK primitives.

## Start here

Choose the target import path before changing any code:

| If you are migrating...                                                       | Use                       |
| ----------------------------------------------------------------------------- | ------------------------- |
| Existing Vercel AI SDK app and you want the clearest gateway-provider imports | `@macpaw/ai-sdk/provider` |
| Shared MacPaw helpers, errors, and stream utilities                           | `@macpaw/ai-sdk`          |
| Direct Gateway HTTP calls or multipart APIs                                   | `@macpaw/ai-sdk/client`   |
| Runtime internals such as transport, validation, retry, SSE helpers           | `@macpaw/ai-sdk/runtime`  |
| React hooks under the MacPaw scope                                            | `@macpaw/ai-sdk/react`    |

If your app already uses `generateText`, `streamText`, tools, agents, or UI streams, keep those flows on upstream `ai` and add `@macpaw/ai-sdk/provider` only for gateway-aware provider construction. Do not move those flows to `client` unless you intentionally need raw HTTP APIs.

## Import changes

### Fast path: exact import swaps

Use these substitutions first. They cover the majority of migrations.

| Before                                                | After                           |
| ----------------------------------------------------- | ------------------------------- |
| `from 'ai'`                                           | keep `from 'ai'`                |
| `from 'ai/internal'`                                  | keep `from 'ai/internal'`       |
| `from 'ai/test'`                                      | keep `from 'ai/test'`           |
| `from '@ai-sdk/openai'`                               | keep `from '@ai-sdk/openai'`    |
| `from '@ai-sdk/react'`                                | `from '@macpaw/ai-sdk/react'`   |
| `from '@macpaw/ai-sdk'` for low-level client creation | `from '@macpaw/ai-sdk/client'`  |
| `from '@macpaw/ai-sdk/client'` for runtime primitives | `from '@macpaw/ai-sdk/runtime'` |

### Low-level HTTP client

Before:

```ts
import { createAIGatewayClient } from '@macpaw/ai-sdk';
```

After:

```ts
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';
```

### Domain types

Before:

```ts
import type { ChatCompletion, CreateChatCompletionRequest } from '@macpaw/ai-sdk';
```

After:

```ts
import type { ChatCompletion, CreateChatCompletionRequest } from '@macpaw/ai-sdk/types';
```

### Vercel AI SDK integrations

Before:

```ts
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
```

After:

```ts
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAIGatewayProvider } from '@macpaw/ai-sdk/provider';
```

Then change only model construction:

Before:

```ts
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });

await generateText({
  model: openai('gpt-4.1-mini'),
  prompt: 'Hello',
});
```

After:

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

### Advanced runtime utilities

Before:

```ts
import { API_PATHS, createFetchTransport, SDKValidationError } from '@macpaw/ai-sdk/client';
```

After:

```ts
import { API_PATHS, createFetchTransport, SDKValidationError } from '@macpaw/ai-sdk/runtime';
```

## What stays on the root package

`@macpaw/ai-sdk` is now a convenience entry for MacPaw-owned app-facing helpers. It includes:

- the same provider-oriented surface as `@macpaw/ai-sdk/provider`
- shared exports such as `AIGatewayError`, `ErrorCode`, `SDKValidationError`, and stream helpers

It does **not** expose:

- `createAIGatewayClient`
- runtime internals such as `createFetchTransport`

Those remain on `@macpaw/ai-sdk/client` and `@macpaw/ai-sdk/runtime`.

## Recommended migration path

1. Keep `generateText`, `streamText`, tools, agents, and stream-consumption code on upstream `ai`.
2. Keep `createOpenAI` and other direct provider factories on upstream `@ai-sdk/*`.
3. Change model construction from direct OpenAI handles to `createAIGatewayProvider(...)` or `createGatewayProvider(...)`.
4. Move any low-level client imports to `@macpaw/ai-sdk/client`.
5. Move advanced transport/config/runtime imports to `@macpaw/ai-sdk/runtime`.
6. Move domain request/response type imports to `@macpaw/ai-sdk/types`.
7. React hooks: Import directly from `@ai-sdk/react`.
8. If you use provider-specific upstream packages such as `@ai-sdk/anthropic` or `@ai-sdk/google`, install them directly in the app and use `createGatewayProvider(...)` from `@macpaw/ai-sdk/provider` for Gateway-backed model handles.

## Vendor-oriented migration patterns

### Vercel-style app plus multipart APIs

Keep `generateText` / `streamText` on upstream `ai` with a gateway-backed provider. Add `client` only for multipart or raw Gateway APIs:

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
