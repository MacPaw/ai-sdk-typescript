# @macpaw/ai-sdk

![AI SDK TypeScript](.github/header.png)

[![CI](https://github.com/macpaw/ai-sdk-typescript/actions/workflows/ci.yml/badge.svg)](https://github.com/macpaw/ai-sdk-typescript/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40macpaw%2Fai-sdk)](https://www.npmjs.com/package/@macpaw/ai-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Thin **Vercel AI SDK** extension for **MacPaw AI Gateway**: OpenAI-compatible providers (`createAIGatewayProvider`, `createGatewayProvider`), a **`createGatewayFetch`** bridge for any HTTP client, a **`createVideoClient`** for video generation, shared **auth / retry / middleware / errors**, and optional **NestJS** wiring.

Core generation APIs stay on upstream **`ai`** and **`@ai-sdk/*`**. This package only adds Gateway-specific construction and the fetch pipeline.

## Package entry points

| Import                    | Use for                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `@macpaw/ai-sdk`          | **Canonical** — providers, `createGatewayFetch`, `createVideoClient`, errors, config types |
| `@macpaw/ai-sdk/provider` | **Alias** of the root entry (same `dist`; for older snippets)                              |
| `@macpaw/ai-sdk/nestjs`   | `AIGatewayModule`, `@InjectAIGateway()`, `AIGatewayExceptionFilter`                        |

Upstream **`ai`**, **`@ai-sdk/openai`**, **`@ai-sdk/react`** (or **`ai/react`**) remain the home for Vercel primitives and React hooks.

There is **no** published `@macpaw/ai-sdk/client`, `@macpaw/ai-sdk/runtime`, `@macpaw/ai-sdk/types`, or `@macpaw/ai-sdk/testing` in this version — use `createGatewayFetch` + `fetch` (or the OpenAI SDK with custom `fetch`) for raw HTTP and multipart. See [MIGRATION.md](./MIGRATION.md).

## Install

```bash
pnpm add @macpaw/ai-sdk
# or
npm install @macpaw/ai-sdk
```

Also install upstream packages you call directly, for example `ai`, `@ai-sdk/openai`, `@ai-sdk/react`.

This package does not pin or wrap the upstream UI/hooks API from `ai` / `@ai-sdk/react`. Follow the versioned upstream docs for the exact major version you install there. If your chosen upstream version requires version-specific imports or patterns (for example schema helpers), use the upstream guidance for those APIs.

## Quick start (Vercel AI SDK)

```ts
import { generateText, streamText } from 'ai';
import { createAIGatewayProvider, ErrorCode } from '@macpaw/ai-sdk';

const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken: async () => (await getSetappSession()).accessToken,
});

const { text } = await generateText({
  model: gateway('openai/gpt-4.1-nano'),
  prompt: 'Hello from AI Gateway',
});

const result = streamText({
  model: gateway('openai/gpt-4.1-nano'),
  prompt: 'Write a poem',
});
for await (const delta of result.textStream) {
  process.stdout.write(delta);
}
```

## Features

- **Vercel-first** — `OpenAIProvider` from `@ai-sdk/openai` + custom `fetch`
- **Auth** — `getAuthToken(forceRefresh?)`; one automatic retry on **401** with `forceRefresh === true`
- **Retry** — exponential backoff for **429** and **5xx** (and some network errors); not for 401/402
- **Middleware** — `(config, next) => Promise<Response>` chain before `fetch`
- **Errors** — Gateway JSON and OpenAI-shaped bodies → `AIGatewayError` subclasses + `ErrorCode`
- **Request ID** — `X-Request-ID` on Gateway requests when missing
- **Timeout** — per attempt, combined with caller `AbortSignal`
- **Video generation** — `createVideoClient` wraps the Gateway video endpoints (create job, poll status, fetch content)
- **Tree-shakeable** — ESM + CJS

## Configuration (`GatewayProviderSettings`)

Used by `createAIGatewayProvider`, `createGatewayProvider`, `createGatewayFetch`, `createVideoClient`, and Nest `AIGatewayModule`.

| Field          | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `getAuthToken` | Required — `Promise<string \| null>`; `true` = refresh after 401 |
| `env`          | `'production'` → default base URL `https://api.macpaw.com/ai`    |
| `baseURL`      | Override gateway root (staging, etc.)                            |
| `headers`      | Extra headers (do not set `Authorization` here)                  |
| `retry`        | `RetryConfig` or `false`                                         |
| `timeout`      | ms per attempt (default `60000`)                                 |
| `middleware`   | Interceptor stack                                                |
| `fetch`        | Custom `fetch` implementation                                    |

Internal resolution: `resolveConfig()` in `gateway-config.ts`.

## `createGatewayFetch` — raw HTTP / multipart

Same auth, retry, middleware, and error normalization as the provider path. The base already includes `/ai`, so use **relative** URLs under it (e.g. `'/v1/images/edits'`, which resolves to `https://api.macpaw.com/ai/v1/images/edits`) or absolute URLs that stay under the same gateway origin.

```ts
import { createGatewayFetch, resolveGatewayBaseURL } from '@macpaw/ai-sdk';

const baseURL = resolveGatewayBaseURL(undefined, 'production', 'gatewayFetch');
const gatewayFetch = createGatewayFetch({
  baseURL,
  getAuthToken: async () => token,
});

const form = new FormData();
form.append('image', imageBlob, 'photo.png');
form.append('prompt', 'Add a hat');
form.append('model', 'openai/dall-e-2');

const res = await gatewayFetch('/v1/images/edits', { method: 'POST', body: form });
```

Non-gateway absolute URLs are passed through without injecting Bearer auth (placeholder key is stripped). See `gateway-fetch.ts`.

`createGatewayFetch` requires a resolved `baseURL`. Use the exported `resolveGatewayBaseURL()` helper if you want the same `'production'` shortcut that provider factories support.

## `createGatewayProvider` — prefixed model IDs

Bare model IDs get a default Gateway prefix per provider constant; IDs that already contain `/` are unchanged.

| Constant                              | Default prefix                        |
| ------------------------------------- | ------------------------------------- |
| `GATEWAY_PROVIDERS.ANTHROPIC`         | `anthropic`                           |
| `GATEWAY_PROVIDERS.GOOGLE`            | `google`                              |
| `GATEWAY_PROVIDERS.XAI`               | `xai`                                 |
| `GATEWAY_PROVIDERS.GROQ`              | `groq`                                |
| `GATEWAY_PROVIDERS.MISTRAL`           | `mistral`                             |
| `GATEWAY_PROVIDERS.AMAZON_BEDROCK`    | `bedrock`                             |
| `GATEWAY_PROVIDERS.AZURE`             | `azure`                               |
| `GATEWAY_PROVIDERS.COHERE`            | `cohere`                              |
| `GATEWAY_PROVIDERS.PERPLEXITY`        | `perplexity`                          |
| `GATEWAY_PROVIDERS.DEEPSEEK`          | `deepseek`                            |
| `GATEWAY_PROVIDERS.TOGETHERAI`        | `togetherai`                          |
| `GATEWAY_PROVIDERS.OPENAI_COMPATIBLE` | **requires** `modelPrefix` in options |

```ts
import { generateText } from 'ai';
import { createGatewayProvider, GATEWAY_PROVIDERS } from '@macpaw/ai-sdk';

const anthropic = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, {
  env: 'production',
  getAuthToken: async () => token,
});

await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Hello',
});
```

## Provider options (`AIGatewayProviderOptions`)

Extends `GatewayProviderSettings` plus OpenAI provider settings (without `apiKey` / `baseURL` / `fetch`, which are wired by the SDK):

- `normalizeErrors` — default `true`; non-OK Gateway responses throw typed errors
- `createOpenAI` — optional override of `createOpenAI` from `@ai-sdk/openai` (tests/advanced)

Use `normalizeErrors: false` only when you intentionally want to inspect raw failed `Response` objects in provider-driven tests or adapters. Auth refresh and retry behavior still stay on; only typed non-OK error throwing is relaxed.

## `createVideoClient` — video generation

Wraps three Gateway endpoints: create a job, poll its status, and fetch binary content. Same auth and error normalization as the other clients.

```ts
import { createVideoClient } from '@macpaw/ai-sdk';

const videos = createVideoClient({
  env: 'production',
  getAuthToken: async () => (await getSetappSession()).accessToken,
});

const job = await videos.create({
  model: 'veo-2',
  prompt: 'A sunset over the ocean',
  seconds: '5',
  size: '1280x720',
});

let current = job;
while (current.status !== 'completed' && current.status !== 'failed') {
  await new Promise((r) => setTimeout(r, 3000));
  current = await videos.get(job.id);
}

const res = await videos.getContent(job.id, 'video');
const buffer = await res.arrayBuffer();
```

`getContent` returns the raw `Response` so callers can consume `.arrayBuffer()`, `.blob()`, or `.body` as a stream — the `Content-Type` is provider-dependent (`video/mp4`, `image/jpeg`, etc.). Pass `'thumbnail'` or `'spritesheet'` as the second argument to fetch those variants instead.

`create` does **not** retry on 5xx — POST video jobs are non-idempotent. Auth retry (401 → fresh token) still applies.

## Middleware

```ts
import type { Middleware } from '@macpaw/ai-sdk';

const loggingMiddleware: Middleware = async (config, next) => {
  const response = await next(config);
  console.log(config.method, config.url, response.status);
  return response;
};
```

## Error handling

| `ErrorCode`                                   | Typical HTTP | Meaning                                |
| --------------------------------------------- | ------------ | -------------------------------------- |
| `AuthRequired`                                | 401          | Token missing / expired                |
| `InsufficientCredits` / `SubscriptionExpired` | 402          | Billing / subscription                 |
| `ModelNotAllowed`                             | 403          | Model denied                           |
| `RateLimited`                                 | 429          | Rate limit (`retryAfter` when present) |
| `Validation`                                  | 422          | Validation body                        |
| …                                             | …            | See `gateway-errors.ts`                |

```ts
import { AIGatewayError, ErrorCode, isAIGatewayError } from '@macpaw/ai-sdk';

try {
  // ...
} catch (e) {
  if (isAIGatewayError(e) && e.code === ErrorCode.InsufficientCredits) {
    // e.metadata.paymentUrl, e.requestId, etc.
  }
}
```

## NestJS

```bash
pnpm add @macpaw/ai-sdk @nestjs/common rxjs
```

Register once (global by default):

```ts
import { AIGatewayModule } from '@macpaw/ai-sdk/nestjs';

AIGatewayModule.forRoot({
  env: 'production',
  getAuthToken: async () => process.env.SETAPP_TOKEN!,
});
```

If your Nest app uses TypeScript subpath exports strictly, make sure its `tsconfig` uses a modern resolver such as `moduleResolution: "Node16"`, `"NodeNext"`, or `"bundler"` so `@macpaw/ai-sdk/nestjs` resolves correctly.

Inject **`GatewayProviderSettings`** (not an HTTP client) and build providers in the service:

```ts
import { Injectable } from '@nestjs/common';
import { InjectAIGateway } from '@macpaw/ai-sdk/nestjs';
import type { GatewayProviderSettings } from '@macpaw/ai-sdk';
import { createAIGatewayProvider } from '@macpaw/ai-sdk';
import { generateText } from 'ai';

@Injectable()
export class ChatService {
  constructor(@InjectAIGateway() private readonly config: GatewayProviderSettings) {}

  async complete(prompt: string) {
    const gateway = createAIGatewayProvider(this.config);
    const { text } = await generateText({
      model: gateway('openai/gpt-4.1-nano'),
      prompt,
    });
    return text;
  }
}
```

`AIGatewayExceptionFilter` maps `AIGatewayError` to JSON HTTP responses. See `examples/nestjs/` for a copy-paste skeleton.

Only documented root exports are public API. Source-level helpers such as `parseErrorResponseFromResponse` and `parseStreamErrorPayload` may exist internally, but they are not supported import targets unless exported from `@macpaw/ai-sdk`.

## Examples

From the repo root:

```bash
pnpm build
pnpm example:provider
```

Set `AI_GATEWAY_TOKEN` or `SETAPP_TOKEN`. Optional: `AI_GATEWAY_BASE_URL`, `AI_GATEWAY_MODEL`.

See [`examples/README.md`](./examples/README.md).

## Release & quality

- CI: `typecheck`, `lint`, `test`, coverage, `build` on Node 18 / 20 / 22
- `pnpm verify:release` — full local gate before publish
- `pnpm size:pack` — dry-run npm pack

## AI assistant setup

Templates for **Cursor** (`.cursor/skills/`), **Claude Code** (`CLAUDE.md`), and **OpenAI Codex** (`AGENTS.md`) ship under `templates/`. After installing the package:

```bash
pnpm exec macpaw-ai-setup
# or: npx macpaw-ai-setup
```

Use `macpaw-ai-setup cursor`, `claude`, or `codex` to install only one target. Existing root `CLAUDE.md` / `AGENTS.md` files get Gateway sections appended, not replaced.

The installed instructions enforce the current package surface and the main auth guardrails:

- prefer `@macpaw/ai-sdk` / `@macpaw/ai-sdk/nestjs`
- keep generation primitives on upstream `ai` / `@ai-sdk/*`
- do not use removed subpaths such as `client`, `runtime`, `types`, or `testing`
- do not invent a token source or expose gateway tokens to browser-only code
- use `baseURL` for staging/custom hosts; `env` supports only `'production'`

## Versioning

[Semantic Versioning](https://semver.org/). Releases via [semantic-release](https://github.com/semantic-release/semantic-release) and Conventional Commits.

## License

MIT © 2026 [MacPaw Way Ltd](https://macpaw.com). See [LICENSE](LICENSE).
