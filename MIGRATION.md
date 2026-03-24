# Migration Guide

## Vercel-First major

This release reframes `@macpaw/ai-sdk` as an extension layer for Vercel AI SDK:

- `@macpaw/ai-sdk/provider` is now the primary app-developer entry point.
- `@macpaw/ai-sdk/client` is the explicit advanced path for direct Gateway HTTP usage.
- `@macpaw/ai-sdk/runtime` is the explicit home for advanced transport/config/request primitives.
- `@macpaw/ai-sdk` is now a slim shared surface for errors, enums, and helper utilities.

## Import changes

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

Use `@macpaw/ai-sdk` for shared, provider-agnostic exports such as:

- `AIGatewayError`
- `ErrorCode`
- stream helper utilities such as `collectChatStream`

## Recommended migration path

1. Move any low-level client imports to `@macpaw/ai-sdk/client`.
2. Move domain request/response type imports to `@macpaw/ai-sdk/types`.
3. Move advanced transport/config/runtime imports to `@macpaw/ai-sdk/runtime`.
4. For Vercel AI SDK apps, consolidate generation helpers and provider setup under `@macpaw/ai-sdk/provider`.
5. Keep React hooks on the Vercel AI SDK side, for example `@ai-sdk/react`.
