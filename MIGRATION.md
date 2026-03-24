# Migration Guide

## Vercel-First major

This release reframes `@macpaw/ai-sdk` as an extension layer for Vercel AI SDK:

- `@macpaw/ai-sdk/provider` is now the primary app-developer entry point.
- `@macpaw/ai-sdk/client` is the explicit advanced path for direct Gateway HTTP usage.
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

## What stays on the root package

Use `@macpaw/ai-sdk` for shared, provider-agnostic exports such as:

- `AIGatewayError`
- `ErrorCode`
- stream helper utilities such as `collectChatStream`

## Recommended migration path

1. Move any low-level client imports to `@macpaw/ai-sdk/client`.
2. Move domain request/response type imports to `@macpaw/ai-sdk/types`.
3. For Vercel AI SDK apps, consolidate generation helpers and provider setup under `@macpaw/ai-sdk/provider`.
4. Keep React hooks on the Vercel AI SDK side, for example `@ai-sdk/react`.
