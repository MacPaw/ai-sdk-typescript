# Migration Guide

## Vercel-First major

This release reframes `@macpaw/ai-sdk` as an extension layer for Vercel AI SDK:

- `@macpaw/ai-sdk/provider` is now the primary app-developer entry point.
- `@macpaw/ai-sdk/client` is the explicit advanced path for direct Gateway HTTP usage.
- `@macpaw/ai-sdk/runtime` is the explicit home for advanced transport/config/request primitives.
- `@macpaw/ai-sdk` now re-exports the Vercel-compatible provider surface for easier `ai` migrations, while keeping low-level client/runtime APIs on explicit subpaths.

## Start here

Choose the target import path before changing any code:

| If you are migrating...                                                       | Use                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| Existing Vercel AI SDK app and you want the smallest diff                     | `@macpaw/ai-sdk`                                       |
| Existing Vercel AI SDK app and you want the clearest provider-focused imports | `@macpaw/ai-sdk/provider`                              |
| Direct Gateway HTTP calls or multipart APIs                                   | `@macpaw/ai-sdk/client`                                |
| Runtime internals such as transport, validation, retry, SSE helpers           | `@macpaw/ai-sdk/runtime`                               |
| React hooks under the MacPaw scope                                            | `@macpaw/ai-sdk/react`                                 |
| `ai/internal` or `ai/test` helpers                                            | `@macpaw/ai-sdk/ai/internal`, `@macpaw/ai-sdk/ai/test` |

If your app already uses `generateText`, `streamText`, tools, agents, or UI streams, start with `@macpaw/ai-sdk` or `@macpaw/ai-sdk/provider`. Do not move those flows to `client` unless you intentionally need raw HTTP APIs.

## Import changes

### Fast path: exact import swaps

Use these substitutions first. They cover the majority of migrations.

| Before                                                | After                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `from 'ai'`                                           | `from '@macpaw/ai-sdk'` or `from '@macpaw/ai-sdk/provider'` |
| `from 'ai/internal'`                                  | `from '@macpaw/ai-sdk/ai/internal'`                         |
| `from 'ai/test'`                                      | `from '@macpaw/ai-sdk/ai/test'`                             |
| `from '@ai-sdk/openai'`                               | `from '@macpaw/ai-sdk'` or `from '@macpaw/ai-sdk/provider'` |
| `from '@ai-sdk/react'`                                | `from '@macpaw/ai-sdk/react'`                               |
| `from '@macpaw/ai-sdk'` for low-level client creation | `from '@macpaw/ai-sdk/client'`                              |
| `from '@macpaw/ai-sdk/client'` for runtime primitives | `from '@macpaw/ai-sdk/runtime'`                             |

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
import { createAIGatewayProvider, generateText, createOpenAI } from '@macpaw/ai-sdk/provider';
```

For dual-backend apps, `createAIGatewayDualProvider()` accepts eager providers or lazy factories, so Setapp / vendor builds can avoid initializing the unused branch.

If you want the smallest diff instead of the most explicit path, this is also valid:

```ts
import { createAIGatewayProvider, generateText, createOpenAI } from '@macpaw/ai-sdk';
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

`@macpaw/ai-sdk` is now a convenience entry for Vercel-style app flows. It includes:

- the same provider-oriented surface as `@macpaw/ai-sdk/provider`
- shared exports such as `AIGatewayError`, `ErrorCode`, and stream helpers

It does **not** expose:

- `createAIGatewayClient`
- runtime internals such as `createFetchTransport`

Those remain on `@macpaw/ai-sdk/client` and `@macpaw/ai-sdk/runtime`.

## Recommended migration path

1. Replace `from 'ai'` with `from '@macpaw/ai-sdk'` or `from '@macpaw/ai-sdk/provider`.
2. Replace `from '@ai-sdk/openai'` with the same MacPaw entry point if you want one package prefix.
3. Change model construction from direct OpenAI handles to `createAIGatewayProvider(...)`.
4. Keep your existing `generateText`, `streamText`, tools, agents, and stream-consumption code unchanged.
5. Move any low-level client imports to `@macpaw/ai-sdk/client`.
6. Move advanced transport/config/runtime imports to `@macpaw/ai-sdk/runtime`.
7. Move domain request/response type imports to `@macpaw/ai-sdk/types`.
8. React hooks: `@macpaw/ai-sdk/react` (re-export) or `@ai-sdk/react`. Optional scoped provider factories: `@macpaw/ai-sdk/anthropic`, `@macpaw/ai-sdk/google` (install matching `@ai-sdk/*` in the app).

## Vendor-oriented migration patterns

### One codebase, two distributions

If one build should use AI Gateway and another should keep direct OpenAI, do not fork your app logic. Select the provider at startup:

```ts
import { createAIGatewayDualProvider, createOpenAI, generateText } from '@macpaw/ai-sdk/provider';

const provider = createAIGatewayDualProvider({
  useGateway: process.env.IS_VENDOR_BUILD === '1',
  gateway: {
    env: 'production',
    getAuthToken: async () => (await getVendorSession()).accessToken,
  },
  direct: () => createOpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
});

await generateText({
  model: provider('openai/gpt-4.1-mini'),
  prompt: 'Hello',
});
```

### Vercel-style app plus multipart APIs

Keep `generateText` / `streamText` on the provider entry. Add `client` only for multipart or raw Gateway APIs:

```ts
import { createAIGatewayProvider, generateText } from '@macpaw/ai-sdk/provider';
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
