# Integration guide — `@macpaw/ai-sdk`

This package is a **small Vercel AI SDK extension** for MacPaw AI Gateway. Upstream **`ai`**, **`@ai-sdk/openai`**, **`@ai-sdk/react`** (or **`ai/react`**) stay the source for core APIs and hooks.

That also means upstream UI/hooks/version migrations stay upstream. If your installed `ai` / `@ai-sdk/react` version changes hook or schema APIs, follow the upstream versioned docs for those packages rather than expecting `@macpaw/ai-sdk` to redefine them.

## Entry points

| Path                      | Role                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `@macpaw/ai-sdk`          | **Use this** — `createAIGatewayProvider`, `createGatewayProvider`, `createGatewayFetch`, `GATEWAY_PROVIDERS`, errors, `GatewayProviderSettings` |
| `@macpaw/ai-sdk/provider` | **Compatibility alias** — same bundle and exports as the root                                                                                   |
| `@macpaw/ai-sdk/nestjs`   | NestJS module, `@InjectAIGateway()`, `AIGatewayExceptionFilter`                                                                                 |

The following paths are **not** published in current versions:

- `@macpaw/ai-sdk/client`
- `@macpaw/ai-sdk/runtime`
- `@macpaw/ai-sdk/types`
- `@macpaw/ai-sdk/testing`

## If you used the old HTTP client

Replace `createAIGatewayClient` with:

1. **Vercel flows** — `createAIGatewayProvider` / `createGatewayProvider` + `generateText` / `streamText` / `embed` from `ai` where the OpenAI-compatible surface is enough.
2. **Raw JSON or multipart** — `createGatewayFetch({ baseURL, getAuthToken, ... })` then `gatewayFetch('/api/v1/...', { method, headers, body })` (e.g. `FormData` for image edits or audio).

Types for request/response bodies can come from your app, from OpenAI SDK types, or from gateway OpenAPI — they are not re-exported from this package today.

If you want the default production Gateway URL in fetch-only flows, use the public `resolveGatewayBaseURL()` helper and pass the resolved value into `createGatewayFetch()`.

## If you used `@macpaw/ai-sdk/runtime`

Internals (`executeRequestPipeline`, etc.) are not part of the public API. Prefer `createGatewayFetch` or provider options (`middleware`, `retry`, `timeout`, `fetch`).

The same applies to source-only error helpers: if a helper is not exported from `@macpaw/ai-sdk`, treat it as internal even if you see it in the repository source.

## Quick import cheatsheet

```ts
import { generateText } from 'ai';
import { createAIGatewayProvider } from '@macpaw/ai-sdk';
```

Equivalent legacy path:

```ts
import { createAIGatewayProvider } from '@macpaw/ai-sdk/provider';
```

## NestJS

`@InjectAIGateway()` provides **`GatewayProviderSettings`**. Build `createAIGatewayProvider(config)` (or `createGatewayFetch`) inside services — there is no injected `AIGatewayClient` type in this package.

## React

Keep `useChat`, `useCompletion`, etc. on **`@ai-sdk/react`** or **`ai/react`**. Configure the server route to use a gateway-backed model from `createAIGatewayProvider`.
