# @macpaw/ai-sdk

[![CI](https://github.com/macpaw/ai-sdk-typescript/actions/workflows/ci.yml/badge.svg)](https://github.com/macpaw/ai-sdk-typescript/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40macpaw%2Fai-sdk)](https://www.npmjs.com/package/@macpaw/ai-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Vercel AI SDK extension layer for AI Gateway with MacPaw and Setapp auth flows, plus an advanced low-level Gateway client when you need direct HTTP control.

`@macpaw/ai-sdk/provider` is the primary product surface for apps already built on Vercel AI SDK. It **re-exports the full `ai` package** (same API as Vercel AI SDK core) and adds AI Gateway wiring, MacPaw error types, and `createOpenAI`. You can migrate by swapping `from 'ai'` to `from '@macpaw/ai-sdk/provider'` and attaching a gateway provider. For a single MacPaw-scoped import prefix, use `@macpaw/ai-sdk/react` for `useChat` / `useCompletion` (re-exports `@ai-sdk/react`), and `@macpaw/ai-sdk/<provider>` for official Vercel provider packages — e.g. `anthropic`, `google`, `xai`, `groq`, `mistral`, `amazon-bedrock`, `azure`, `cohere`, `perplexity`, `deepseek`, `togetherai`, `openai-compatible` — each re-exporting the matching `@ai-sdk/<provider>` (install that peer in the app). `@macpaw/ai-sdk/client` is the focused advanced path for multipart APIs and direct Gateway control. `@macpaw/ai-sdk/runtime` exposes advanced transport, validation, and request-pipeline primitives when you intentionally need the internals.

The root package `@macpaw/ai-sdk` is also safe for Vercel-style app flows and now re-exports the same provider surface as `@macpaw/ai-sdk/provider`. In practice:

- Use `@macpaw/ai-sdk/provider` when you want the most explicit entry point for provider-based app code
- Use `@macpaw/ai-sdk` when you want the smallest import diff from existing `ai`-based code
- Use `@macpaw/ai-sdk/client` only for direct Gateway HTTP APIs, multipart endpoints, or request-pipeline control
- Use `@macpaw/ai-sdk/runtime` only for advanced transport/config internals

## Features

- **Vercel-first** — Built as an extension layer on top of Vercel AI SDK
- **Streaming** — SSE parsing for chat, responses, and audio transcription APIs
- **Rich stream results** — `.stream()` returns `textStream`, `text` promise, and `abort()` (AI SDK-inspired)
- **Full API coverage** — Chat, Responses, Embeddings, Images, Audio, Models
- **Retry** — Exponential backoff for 429 and 5xx (never retries 402/401)
- **Middleware** — Request interceptors for logging, metrics, custom headers
- **Lifecycle hooks** — `onRequest`, `onResponse`, `onError`, `onRetry`
- **Error normalization** — AI Gateway HTTP API and OpenAI-format errors mapped to stable `ErrorCode` enum
- **Auth** — Pluggable `getAuthToken()` for Setapp Bearer token
- **Request ID tracking** — Automatic `X-Request-ID` generation
- **AbortController** — Per-request signal and configurable timeout
- **Typed** — Full TypeScript types, const-object enums for all codes/roles
- **Tree-shakeable** — ESM + CJS with minimal runtime dependencies
- **Advanced client path** — Explicit `@macpaw/ai-sdk/client` for multipart and low-level Gateway usage
- **Explicit runtime layer** — `@macpaw/ai-sdk/runtime` for advanced transport/config/request primitives without overloading the client entry
- **Scoped Vercel companions** — `@macpaw/ai-sdk/react` plus `@macpaw/ai-sdk/<provider>` mirrors (anthropic, google, xai, groq, mistral, amazon-bedrock, azure, cohere, perplexity, deepseek, togetherai, openai-compatible) re-export the matching `@ai-sdk/*` packages so imports can stay under `@macpaw/ai-sdk/*`
- **Gateway provider mirrors** — each provider subpath also exports a `createGateway<Name>` factory (e.g. `createGatewayAnthropic`) that creates an AI Gateway-backed provider with automatic model ID prefixing — vendors can write `provider('claude-sonnet-4-20250514')` and traffic routes through Gateway as `anthropic/claude-sonnet-4-20250514`

## Install

```bash
pnpm add @macpaw/ai-sdk
# or
npm install @macpaw/ai-sdk
```

If your app also imports upstream packages directly, install those explicitly in the app too:

- `react` and `@ai-sdk/react` when using `@macpaw/ai-sdk/react` (or import hooks from `@ai-sdk/react` directly)
- the matching `@ai-sdk/<provider>` peer for each `@macpaw/ai-sdk/<provider>` subpath you use (see `package.json` `exports` for the full list)
- `ai` or `@ai-sdk/openai` if you intentionally import from them alongside `@macpaw/ai-sdk/provider`

For breaking import-path changes in this major, see [`MIGRATION.md`](./MIGRATION.md).

## Choose the right entry point

Use this table first. It avoids almost all integration mistakes.

| If your app needs...                                                                                | Import from                                                                  | Why                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Existing `generateText`, `streamText`, tools, agents, UI streams, or other Vercel AI SDK core flows | `@macpaw/ai-sdk/provider` or `@macpaw/ai-sdk`                                | Same Vercel-style surface plus AI Gateway helpers                                                          |
| The smallest migration diff from `import { ... } from 'ai'`                                         | `@macpaw/ai-sdk`                                                             | Root convenience entry re-exports the provider surface                                                     |
| Explicit provider-oriented app architecture                                                         | `@macpaw/ai-sdk/provider`                                                    | Makes the Vercel/Gateway layer obvious in code review                                                      |
| Multipart APIs such as image edits or audio uploads                                                 | `@macpaw/ai-sdk/client`                                                      | These are implemented on the low-level HTTP client path                                                    |
| Retry, transport, validation, SSE, and request-pipeline primitives                                  | `@macpaw/ai-sdk/runtime`                                                     | Advanced internal/runtime layer                                                                            |
| React hooks under one MacPaw package scope                                                          | `@macpaw/ai-sdk/react`                                                       | Re-exports `@ai-sdk/react`                                                                                 |
| Vercel provider factories under one MacPaw package scope                                            | `@macpaw/ai-sdk/anthropic`, `@macpaw/ai-sdk/google`, `@macpaw/ai-sdk/xai`, … | Each subpath re-exports `@ai-sdk/<same-name>` and adds a `createGateway<Name>` factory for Gateway routing |

### Common import swaps

For most migrations, use these direct substitutions:

| Before                                                | After                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `from 'ai'`                                           | `from '@macpaw/ai-sdk'` or `from '@macpaw/ai-sdk/provider'` |
| `from 'ai/internal'`                                  | `from '@macpaw/ai-sdk/ai/internal'`                         |
| `from 'ai/test'`                                      | `from '@macpaw/ai-sdk/ai/test'`                             |
| `from '@ai-sdk/openai'`                               | `from '@macpaw/ai-sdk'` or `from '@macpaw/ai-sdk/provider'` |
| `from '@ai-sdk/react'`                                | `from '@macpaw/ai-sdk/react'`                               |
| `from '@macpaw/ai-sdk'` for low-level client creation | `from '@macpaw/ai-sdk/client'`                              |
| `from '@macpaw/ai-sdk/client'` for runtime primitives | `from '@macpaw/ai-sdk/runtime'`                             |

## Release Signals

- CI validates `typecheck`, `lint`, `test`, coverage, and `build` on Node `18`, `20`, and `22`
- Releases are automated with `semantic-release`
- PRs run a publish dry run and report package size / unpacked size
- Run `pnpm size:pack` locally to inspect what would be published to npm
- Run `pnpm verify:release` before publishing to execute the full local release gate: typecheck, lint, test, build, and npm pack dry-run

## Compatibility guarantees

- `@macpaw/ai-sdk/provider` and `@macpaw/ai-sdk/ai` re-export the upstream `ai` surface, then add AI Gateway helpers on top
- `@macpaw/ai-sdk/ai/internal` and `@macpaw/ai-sdk/ai/test` are explicit compatibility shims for upstream `ai/internal` and `ai/test`
- `@macpaw/ai-sdk/react` and each `@macpaw/ai-sdk/<provider>` mirror re-export the matching upstream `@ai-sdk/*` package under the MacPaw namespace
- `@macpaw/ai-sdk/client`, `@macpaw/ai-sdk/runtime`, and `@macpaw/ai-sdk/testing` stay intentionally explicit so low-level runtime APIs, app-facing APIs, and test helpers do not leak into each other

### TypeScript types

For request/response shapes (chat, embeddings, images, audio, and shared helpers), import from `@macpaw/ai-sdk/types`.

```ts
import type { CreateChatCompletionRequest, ChatCompletion } from '@macpaw/ai-sdk/types';
```

## Quick start

```ts
import { createAIGatewayProvider, generateText, streamText, ErrorCode } from '@macpaw/ai-sdk/provider';

const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken: async () => (await getSetappSession()).accessToken,
});

const { text } = await generateText({
  model: gateway('openai/gpt-4.1-nano'),
  prompt: 'Hello from AI Gateway',
});
console.log(text);

const result = streamText({
  model: gateway('openai/gpt-4.1-nano'),
  prompt: 'Write a poem',
});
for await (const delta of result.textStream) {
  process.stdout.write(delta);
}
const fullText = await result.text;
```

### Advanced HTTP client

If you need multipart endpoints such as image edits or audio uploads, or you want the Gateway request pipeline directly, use `@macpaw/ai-sdk/client`.

```ts
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';
import { ErrorCode } from '@macpaw/ai-sdk';

const client = createAIGatewayClient({
  env: 'production',
  getAuthToken: async () => (await getSetappSession()).accessToken,
});

const completion = await client.chat.completions.create({
  model: 'openai/gpt-4.1-nano',
  messages: [{ role: 'user', content: 'Hello' }],
});

console.log(completion.choices[0]?.message?.content, ErrorCode.AuthRequired);
```

## Advanced client configuration

```ts
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';

const client = createAIGatewayClient({
  // Required: auth token provider
  getAuthToken: async () => myToken,

  // Environment (selects default production base URL)
  env: 'production',

  // Or explicit base URL (use this for staging/testing environments)
  // baseURL: 'https://your-staging-url.example.com/ai',

  // Retry policy (default: 3 attempts, exponential backoff)
  retry: { maxAttempts: 3, initialDelayMs: 1000, maxDelayMs: 30000 },
  // retry: false,  // disable retry

  // Request timeout in ms (default: 60000)
  timeout: 30000,

  // Extra headers for every request
  headers: { 'X-App-Version': '1.0.0' },

  // Middleware interceptors
  middleware: [loggingMiddleware],

  // Custom HTTP transport
  transport: myCustomTransport,

  // Logger (no-op by default)
  logger: console,

  // Lifecycle hooks for observability
  hooks: {
    onRequest: (config) => console.log('Request:', config.url),
    onResponse: (config, response) => console.log('Response:', response.status),
    onError: (error, config) => Sentry.captureException(error),
    onRetry: (attempt, error, config) => console.log(`Retry #${attempt}`),
  },

  // Auto-generate X-Request-ID header (default: true)
  generateRequestId: true,

  // API version prefix (default: 'v1' → /api/v1/...)
  // apiVersion: 'v2',
});
```

If you need lower-level request-pipeline primitives such as `API_PATHS`, `createFetchTransport`, or `SDKValidationError`, import them from `@macpaw/ai-sdk/runtime` instead of the client entry.

## Examples

Runnable examples live in [`examples/`](./examples/README.md):

- `pnpm example:mock` — local demo with `createMockTransport`
- `pnpm example:client` — direct Gateway HTTP client flow
- `pnpm example:provider` — Vercel AI SDK-style provider flow
- `examples/nestjs/` — copy-ready NestJS module/controller/service skeleton

## API Reference

### Chat Completions

```ts
// Non-streaming
const completion = await client.chat.completions.create({
  model: 'openai/gpt-4.1-nano',
  messages: [{ role: 'user', content: 'Explain quantum computing' }],
  temperature: 0.7,
  max_tokens: 500,
});

// Streaming (classic for-await)
for await (const chunk of client.chat.completions.create({
  model: 'openai/gpt-4.1-nano',
  messages: [{ role: 'user', content: 'Write a poem' }],
  stream: true,
})) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}

// Rich streaming with .stream() — returns textStream, text promise, abort()
const result = client.chat.completions.stream({
  model: 'openai/gpt-4.1-nano',
  messages: [{ role: 'user', content: 'Write a poem' }],
});

for await (const delta of result.textStream) {
  process.stdout.write(delta);
}

// Or just get the full text
const fullText = await result.text;

// Abort at any time
result.abort();
```

### Responses API

```ts
// Non-streaming (OpenAI Responses format)
const response = await client.responses.create({
  model: 'openai/gpt-4.1-nano',
  input: 'What is the meaning of life?',
});
console.log(response.output[0].content[0].text);

// Streaming (classic for-await)
for await (const event of client.responses.createStream({
  model: 'openai/gpt-4.1-nano',
  input: 'Tell me a story',
})) {
  if (event.type === 'response.output_text.delta') {
    process.stdout.write(event.delta ?? '');
  }
}

// Rich streaming with .stream()
const result = client.responses.stream({
  model: 'openai/gpt-4.1-nano',
  input: 'Tell me a story',
});
for await (const delta of result.textStream) {
  process.stdout.write(delta);
}
const fullText = await result.text;
```

### Embeddings

```ts
const result = await client.embeddings.create({
  model: 'openai/text-embedding-3-small',
  input: 'Hello world',
});
console.log(result.data[0].embedding);
```

### Images

```ts
import { ImageSize } from '@macpaw/ai-sdk';

// Generate
const image = await client.images.generate({
  prompt: 'A white cat sitting on a laptop',
  model: 'openai/dall-e-3',
  size: ImageSize.S1024,
});
console.log(image.data[0].url);

// Edit (multipart/form-data)
const edited = await client.images.edit({
  image: imageFile,
  prompt: 'Add a hat to the cat',
  model: 'openai/dall-e-2',
});
```

### Audio

```ts
import { AudioFormat } from '@macpaw/ai-sdk';

// Transcription
const transcription = await client.audio.transcriptions.create({
  file: audioFile,
  model: 'openai/gpt-4o-transcribe',
  language: 'en',
  response_format: AudioFormat.VerboseJson,
});
console.log(transcription.text);

// Streaming transcription
for await (const event of client.audio.transcriptions.create({
  file: audioFile,
  model: 'openai/gpt-4o-transcribe',
  stream: true,
})) {
  if (event.type === 'transcript.text.delta') {
    process.stdout.write(event.delta ?? '');
  }
}

// Translation
const translation = await client.audio.translations.create({
  file: audioFile,
  model: 'openai/whisper-1',
});
```

### Models

```ts
const models = await client.models.getInfo();
console.log(models.data.map((m) => m.model_name));

// Single model info
const model = await client.models.getInfo({ litellm_model_id: 'openai/gpt-4.1-nano' });
```

### Per-request options

Every API method accepts an optional `RequestOptions` parameter:

```ts
const controller = new AbortController();

const completion = await client.chat.completions.create(
  { model: 'openai/gpt-4.1-nano', messages: [{ role: 'user', content: 'Hi' }] },
  {
    signal: controller.signal,
    timeout: 10000,
    headers: { 'X-Trace-Id': 'abc-123' },
  },
);

import { anySignal } from '@macpaw/ai-sdk/runtime';

// Combine multiple abort signals (e.g. user cancel + timeout)
const completion2 = await client.chat.completions.create(
  { model: 'openai/gpt-4.1-nano', messages: [] },
  { signal: anySignal([controller.signal, AbortSignal.timeout(30_000)]) },
);
```

> **Tip — streaming timeout:** The default timeout (60 s) applies **per retry attempt**,
> not to the total stream duration. For long-running streams (chat, responses), consider
> passing a larger `timeout` or using an `AbortSignal.timeout()` via the `signal` option
> to control the overall lifetime independently.

#### Accessing response headers (`withResponse`)

Pass `{ withResponse: true }` to get the raw `Response` alongside the parsed body:

```ts
const { data, response } = await client.chat.completions.create(
  { model: 'openai/gpt-4.1-nano', messages: [{ role: 'user', content: 'Hi' }] },
  { withResponse: true },
);

console.log(response.headers.get('x-request-id'));
console.log(data.choices[0].message.content);
```

`response` is the native [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object from the Fetch API.

## Middleware

Add request interceptors for logging, metrics, auth refresh, etc.

```ts
// At creation time
const client = createAIGatewayClient({
  // ...
  middleware: [loggingMiddleware, metricsMiddleware],
});

// Or dynamically
client.use(async (config, next) => {
  const start = performance.now();
  const response = await next(config);
  console.log(`${config.method} ${config.url} — ${performance.now() - start}ms`);
  return response;
});
```

## Error handling

The SDK normalizes errors from both the gateway HTTP API and OpenAI proxy formats into `AIGatewayError` with stable codes accessible via the `ErrorCode` const-object enum:

| Code                            | HTTP Status | Meaning                  |
| ------------------------------- | ----------- | ------------------------ |
| `ErrorCode.AuthRequired`        | 401         | Missing or expired token |
| `ErrorCode.InsufficientCredits` | 402         | Not enough credits       |
| `ErrorCode.SubscriptionExpired` | 402         | Subscription expired     |
| `ErrorCode.ModelNotAllowed`     | 403         | Model access denied      |
| `ErrorCode.RateLimited`         | 429         | Too many requests        |
| `ErrorCode.BadRequest`          | 400         | Invalid request          |
| `ErrorCode.Validation`          | 422         | Field validation error   |
| `ErrorCode.InternalServerError` | 500         | Server error             |

```ts
import { AIGatewayError, ErrorCode } from '@macpaw/ai-sdk';

try {
  await client.chat.completions.create({ model: '...', messages: [...] });
} catch (e) {
  if (e instanceof AIGatewayError) {
    switch (e.code) {
      case ErrorCode.InsufficientCredits:
        // Redirect to payment — e.paymentUrl is available
        window.location.href = e.paymentUrl ?? '/upgrade';
        break;
      case ErrorCode.AuthRequired:
        await refreshToken();
        break;
      case ErrorCode.RateLimited:
        // e.retryAfter contains seconds to wait
        await sleep((e.retryAfter ?? 60) * 1000);
        break;
      case ErrorCode.ModelNotAllowed:
        showError('This model is not available for your plan.');
        break;
    }
    // e.requestId — for support tickets
    // e.metadata — full error details
  }
}
```

## Const-object enums

All code and status types use the const-object pattern for optimal DX — autocomplete, `switch` exhaustiveness, and runtime access:

```ts
import { ErrorCode, MessageRole, ImageSize, AudioFormat } from '@macpaw/ai-sdk';

// Use as values
ErrorCode.AuthRequired; // 'AUTH_REQUIRED'
MessageRole.User; // 'user'
ImageSize.S1024; // '1024x1024'
AudioFormat.VerboseJson; // 'verbose_json'

// Use as types
function handleError(code: ErrorCode) {
  switch (code) {
    case ErrorCode.AuthRequired: // ...
    case ErrorCode.RateLimited: // ...
  }
}
```

## Custom transport

Replace the default fetch-based transport:

```ts
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';

const client = createAIGatewayClient({
  env: 'production',
  getAuthToken: async () => token,
  transport: {
    async request(config) {
      // Use axios, undici, or any HTTP client
      return fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.body,
        signal: config.signal,
      });
    },
  },
});
```

## Non-production environments

For staging, sandbox, or testing environments, pass the URL explicitly via `baseURL`:

```ts
const client = createAIGatewayClient({
  baseURL: 'https://your-staging-gateway.example.com/ai',
  getAuthToken: async () => testToken,
});
```

## Vercel AI SDK integration

For apps already built on Vercel AI SDK (`generateText`, `streamText`, tool calling, and React hooks such as `useChat` / `useCompletion`), `@macpaw/ai-sdk/provider` is the primary integration path.

Today this layer targets the OpenAI-compatible Vercel provider path via `@ai-sdk/openai` for model handles: keep your existing call sites and swap how models are constructed and routed through AI Gateway.

The provider entry includes:

- **Everything from `ai`** (`export * from 'ai'`) — agents, UI message streams, `rerank`, `generateImage`, experimental APIs, and the rest of the Vercel AI SDK core surface
- OpenAI provider helpers such as `createOpenAI`
- AI Gateway-specific helpers: `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createAIGatewayFetch`
- Gateway-focused errors (`AIGatewayError`, `ErrorCode`, …) alongside upstream `AISDKError` types from `ai`

That means an app can keep its existing `ai-sdk` flow and swap the import path plus the provider layer. Keep `ai` and `@macpaw/ai-sdk` on **compatible major versions** (see peer dependency ranges on the package).

### Minimal migration checklist

If you are integrating from an existing Vercel AI SDK app, do these steps in order:

1. Replace `from 'ai'` with `from '@macpaw/ai-sdk'` or `from '@macpaw/ai-sdk/provider'`.
2. Replace `from '@ai-sdk/openai'` with the same MacPaw entry point if you want one package prefix.
3. Create a Gateway provider with `createAIGatewayProvider(...)`.
4. Change only model construction, for example `openai('gpt-4.1-mini')` to `gateway('openai/gpt-4.1-mini')`.
5. Keep your existing `generateText`, `streamText`, tools, agents, and stream-consumption code unchanged.
6. Move only multipart or raw HTTP Gateway flows to `@macpaw/ai-sdk/client`.

If you follow those six steps, you usually do not need to rewrite prompts, tool definitions, or streaming loops.

### Choosing a provider pattern

Use this table when you already have an app on Vercel AI SDK (or any stack that passes `LanguageModel` / `model` into `generateText`, `streamText`, agents, and so on) and only want to change how requests reach a backend:

| Situation                                                                                                                                | Use                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single backend: always AI Gateway                                                                                                        | `createAIGatewayProvider`                                                                                                                                                                                                     |
| One codebase, two shippings: marketplace / Setapp-style build uses Gateway, standalone build uses your own OpenAI-compatible key or host | `createAIGatewayDualProvider` — drive `useGateway` from an env or build flag (for example `process.env.IS_SETAPP_BUILD === '1'`)                                                                                              |
| Short aliases (`fast`, `smart`) on top of the same Gateway backend                                                                       | `createAIGatewayCustomProvider` — use `registry.languageModel('fast')` for aliases and the `gateway('vendor/model')` handle for every other id (same transport; TypeScript only lists alias keys on `registry.languageModel`) |

**Vendors (Electron, Tauri, existing JS apps):** you can keep `ai` and `@ai-sdk/openai` for the build that talks to OpenAI directly, add `@macpaw/ai-sdk` for the Gateway build, and share the same call sites by swapping the provider instance (especially with `createAIGatewayDualProvider`). You do not rewrite tool definitions or streaming loops—only how the model handle is constructed.

### Gateway provider mirrors

Each `@macpaw/ai-sdk/<provider>` subpath exports a `createGateway<Name>` factory that creates an AI Gateway-backed provider with automatic model ID prefixing. This lets vendors use familiar provider-scoped model names without manually adding the routing prefix.

| Subpath                            | Gateway factory                 | Default prefix           |
| ---------------------------------- | ------------------------------- | ------------------------ |
| `@macpaw/ai-sdk/anthropic`         | `createGatewayAnthropic`        | `anthropic`              |
| `@macpaw/ai-sdk/google`            | `createGatewayGoogle`           | `google`                 |
| `@macpaw/ai-sdk/xai`               | `createGatewayXai`              | `xai`                    |
| `@macpaw/ai-sdk/groq`              | `createGatewayGroq`             | `groq`                   |
| `@macpaw/ai-sdk/mistral`           | `createGatewayMistral`          | `mistral`                |
| `@macpaw/ai-sdk/amazon-bedrock`    | `createGatewayBedrock`          | `bedrock`                |
| `@macpaw/ai-sdk/azure`             | `createGatewayAzure`            | `azure`                  |
| `@macpaw/ai-sdk/cohere`            | `createGatewayCohere`           | `cohere`                 |
| `@macpaw/ai-sdk/perplexity`        | `createGatewayPerplexity`       | `perplexity`             |
| `@macpaw/ai-sdk/deepseek`          | `createGatewayDeepseek`         | `deepseek`               |
| `@macpaw/ai-sdk/togetherai`        | `createGatewayTogetherAI`       | `togetherai`             |
| `@macpaw/ai-sdk/openai-compatible` | `createGatewayOpenAICompatible` | (required `modelPrefix`) |

```ts
import { createGatewayAnthropic } from '@macpaw/ai-sdk/anthropic';
import { generateText } from '@macpaw/ai-sdk/provider';

const anthropic = createGatewayAnthropic({
  env: 'production',
  getAuthToken: async () => (await getSetappSession()).accessToken,
});

// Model ID is automatically prefixed: 'anthropic/claude-sonnet-4-20250514'
const { text } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Explain quantum computing',
});

// IDs with '/' are sent as-is (no double-prefixing)
const { text: text2 } = await generateText({
  model: anthropic('anthropic/claude-sonnet-4-20250514'),
  prompt: 'Already prefixed',
});
```

Override the default prefix with `modelPrefix`:

```ts
const bedrock = createGatewayBedrock({
  env: 'production',
  getAuthToken: async () => token,
  modelPrefix: 'amazon-bedrock',
});
```

Each mirror still re-exports the upstream `@ai-sdk/<name>` surface, so direct-use imports like `createAnthropic` remain available alongside the gateway factory.

**Auth vs middleware:** Bearer acquisition and refresh belong in `getAuthToken` (and related provider options). If you need a shared HTTP pipeline with interceptors, retries, and lifecycle hooks on _raw_ Gateway calls, use `createAIGatewayClient` and `client.use(middleware)` for those code paths, or keep the provider for `generateText` / `streamText` and use the client only for multipart or other APIs the OpenAI-shaped provider does not cover (see the table below).

### When to use the HTTP client vs the provider

| Need                                                                                                                                 | Use                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Chat, responses, tools, embeddings, and existing `ai-sdk` flows                                                                      | `@macpaw/ai-sdk/provider` — `createAIGatewayProvider`, `createAIGatewayCustomProvider`, or `createAIGatewayDualProvider` |
| Multipart endpoints (image **edits**, audio upload), or you want the SDK request pipeline (middleware, hooks, retries) on every call | `@macpaw/ai-sdk/client` — `createAIGatewayClient`                                                                        |
| Both in one app                                                                                                                      | Use the **provider** for Vercel AI SDK flows and the **client** only where the OpenAI-compat provider is not enough      |

Image **generation** (JSON body) may work through the OpenAI-shaped provider when the gateway exposes it like OpenAI; image **edits** and **audio** use `FormData` and are implemented on the HTTP client today.

### Optional: switch gateway vs direct OpenAI with an env flag

Keep one code path (e.g. `generateText({ model, prompt })`) and choose the provider at startup. Tokens stay out of your prompts: use `getAuthToken` for the gateway branch.

```ts
import { createAIGatewayDualProvider, createOpenAI, generateText } from '@macpaw/ai-sdk/provider';

const provider = createAIGatewayDualProvider({
  useGateway: process.env.IS_SETAPP_BUILD === '1',
  gateway: {
    env: 'production',
    getAuthToken: async () => (await getSetappSession()).accessToken,
  },
  direct: () => createOpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
});

const { text } = await generateText({
  model: provider('openai/gpt-4.1-nano'),
  prompt: 'Hello!',
});
```

`gateway` and `direct` can both be passed eagerly or lazily. Lazy factories are useful when one branch depends on build-specific env such as `OPENAI_API_KEY` and should not be initialized unless selected.

If you want explicit control instead of the helper, `@macpaw/ai-sdk/provider` also exports `createOpenAI`, so the old manual ternary still works. For alias registries (e.g. `fast`, `smart`) with gateway fallback, use `createAIGatewayCustomProvider` (see below).

### Vendor-oriented scenarios

These are the most common integration shapes for vendors shipping the same app in more than one environment.

#### Scenario 1: Existing Next.js or Node app already using Vercel AI SDK

Goal: keep the current `generateText` / `streamText` code and switch only model routing.

```ts
import { createAIGatewayProvider, generateText, streamText } from '@macpaw/ai-sdk/provider';

const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken: async () => (await getSetappSession()).accessToken,
});

await generateText({
  model: gateway('openai/gpt-4.1-mini'),
  prompt: 'Summarize this page',
});

const result = streamText({
  model: gateway('openai/gpt-4.1-mini'),
  prompt: 'Write a release note',
});
```

What changes:

- Imports move to `@macpaw/ai-sdk/provider` or `@macpaw/ai-sdk`
- Model handles come from `createAIGatewayProvider`

What stays the same:

- `generateText`, `streamText`, tools, agents, and stream handling

#### Scenario 2: One vendor codebase, two builds

Goal: use AI Gateway for marketplace / Setapp-style builds, but keep direct OpenAI for another distribution without forking the app logic.

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

const { text } = await generateText({
  model: provider('openai/gpt-4.1-nano'),
  prompt: 'Hello',
});
```

What changes:

- Provider selection moves to startup/config time

What stays the same:

- The app still calls `generateText({ model, prompt })` in exactly one way

#### Scenario 3: Provider for app flows, client for multipart

Goal: keep Vercel-style text generation, but use the low-level client where the OpenAI-shaped provider is not enough.

```ts
import { createAIGatewayProvider, generateText } from '@macpaw/ai-sdk/provider';
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';

const auth = async () => (await getSetappSession()).accessToken;

const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken: auth,
});

const client = createAIGatewayClient({
  env: 'production',
  getAuthToken: auth,
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

What changes:

- Text/chat/tool flows stay on the provider
- Multipart and raw API flows use the client

What stays the same:

- One auth source can be reused across both layers

### Where authentication runs

- **Gateway path:** `getAuthToken` passed to `createAIGatewayProvider` / `createAIGatewayClient` runs whenever the SDK issues a request; it can read cookies, session stores, or env. No need to put the Bearer string in application code paths if you centralize it here.
- **Gateway provider fetch:** `createAIGatewayProvider` and `createAIGatewayFetch` support token refresh-aware `getAuthToken(forceRefresh?)`, token caching, request IDs, and gateway error normalization.
- **Next.js App Router:** resolve the token in a **server** route or server action (same place you call `streamText`), or in middleware that attaches session info your `getAuthToken` reads — avoid exposing long-lived tokens to the browser.
- **Express / Fastify:** read the session in your route handler and pass a closure: `getAuthToken: async () => req.session?.aiToken ?? null`.

### Option A: High-level provider (recommended)

```ts
import { createAIGatewayProvider, generateText, streamText } from '@macpaw/ai-sdk/provider';

const gateway = createAIGatewayProvider({
  getAuthToken: async () => (await getSetappSession()).accessToken,
  env: 'production',
});

// generateText
const { text } = await generateText({
  model: gateway('openai/gpt-4.1-nano'),
  prompt: 'Hello!',
});

// streamText
const result = streamText({
  model: gateway('openai/gpt-4.1-nano'),
  prompt: 'Write a haiku',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Option A2: `customProvider` (aliases + fallback)

Use the Vercel AI SDK [`customProvider`](https://sdk.vercel.ai/docs/reference/ai-sdk-core/custom-provider) with AI Gateway as fallback, or use `createAIGatewayCustomProvider`:

```ts
import { createAIGatewayProvider, createAIGatewayCustomProvider, generateText } from '@macpaw/ai-sdk/provider';

const gateway = createAIGatewayProvider({
  getAuthToken: async () => myToken,
  env: 'production',
});

const registry = createAIGatewayCustomProvider(gateway, {
  languageModels: {
    fast: gateway('openai/gpt-4.1-nano'),
  },
});

await generateText({ model: registry.languageModel('fast'), prompt: 'Hi' });

// For model ids you did not register as aliases, keep using the same gateway handle.
// At runtime, `customProvider` can fall back for unknown ids when you use the raw
// `customProvider` API; this helper narrows `registry.languageModel(...)` to your
// registered keys only, so open-ended ids are passed via `gateway(...)` instead.
await generateText({
  model: gateway('openai/gpt-4.1-mini'),
  prompt: 'Still AI Gateway',
});
```

You can pass a prebuilt gateway provider, gateway options, or a lazy factory for either. Lazy gateway factories are resolved on the first fallback lookup, so alias-only usage does not initialize the fallback branch. For full control, import `customProvider` from `@macpaw/ai-sdk/provider` and pass `fallbackProvider: createAIGatewayProvider({ ... })`.

### Option B: Low-level custom fetch

```ts
import { createAIGatewayFetch, createOpenAI } from '@macpaw/ai-sdk/provider';

const customFetch = createAIGatewayFetch({
  baseURL: 'https://api.macpaw.com/ai',
  getAuthToken: async () => myToken,
  autoRefreshToken: true,
  normalizeErrors: true,
});

const openai = createOpenAI({
  baseURL: 'https://api.macpaw.com/ai/api/v1',
  fetch: customFetch,
  apiKey: 'unused',
});
```

If you want fetch-like status inspection instead of thrown `AIGatewayError` instances for non-OK Gateway responses, set `normalizeErrors: false`.

> **Version alignment:** `@macpaw/ai-sdk/provider` re-exports helpers from `ai` and `@ai-sdk/openai`. If your app also imports those packages directly, keep their versions aligned with this SDK to avoid duplicate-install edge cases.
> React hooks still come from `@ai-sdk/react`.

### React hooks

```tsx
import { useChat } from '@ai-sdk/react';

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat', // your Next.js API route
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## Framework examples

### Browser (vanilla)

```ts
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';
import { AIGatewayError, ErrorCode } from '@macpaw/ai-sdk';

const client = createAIGatewayClient({
  env: 'production',
  getAuthToken: async () => localStorage.getItem('setapp_token'),
});

document.querySelector('#ask-btn')!.addEventListener('click', async () => {
  const output = document.querySelector('#output')!;
  output.textContent = '';

  try {
    const result = client.chat.completions.stream({
      model: 'openai/gpt-4.1-nano',
      messages: [{ role: 'user', content: 'Tell me a joke' }],
    });
    for await (const delta of result.textStream) {
      output.textContent += delta;
    }
  } catch (e) {
    if (e instanceof AIGatewayError && e.code === ErrorCode.InsufficientCredits) {
      window.location.href = e.paymentUrl ?? '/upgrade';
    }
  }
});
```

### Node.js / Express

```ts
import express from 'express';
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';
import { AIGatewayError } from '@macpaw/ai-sdk';

const client = createAIGatewayClient({
  env: 'production',
  getAuthToken: async () => process.env.SETAPP_TOKEN!,
});

const app = express();
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const completion = await client.chat.completions.create({
      model: 'openai/gpt-4.1-nano',
      messages: req.body.messages,
    });
    res.json(completion);
  } catch (e) {
    if (e instanceof AIGatewayError) {
      res.status(e.statusCode).json({ error: e.code, message: e.message });
    } else {
      res.status(500).json({ error: 'UNKNOWN' });
    }
  }
});

app.listen(3000);
```

### NestJS (Module)

The SDK provides a first-class NestJS integration with `DynamicModule`, injectable client, custom decorator, and exception filter.

```bash
pnpm add @macpaw/ai-sdk @nestjs/common rxjs
```

#### 1. Register the module

**Static configuration** (`forRoot`):

```ts
import { Module } from '@nestjs/common';
import { AIGatewayModule } from '@macpaw/ai-sdk/nestjs';

@Module({
  imports: [
    AIGatewayModule.forRoot({
      env: 'production',
      getAuthToken: async () => process.env.SETAPP_TOKEN!,
    }),
  ],
})
export class AppModule {}
```

**Async configuration** (`forRootAsync`) — ideal with `ConfigService`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AIGatewayModule } from '@macpaw/ai-sdk/nestjs';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AIGatewayModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        env: config.get('AI_GATEWAY_ENV', 'production'),
        getAuthToken: async () => config.get('SETAPP_TOKEN')!,
        hooks: {
          onError: (error) => console.error('[AI Gateway]', error),
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

The module is **global** by default — no need to re-import in every module. Set `isGlobal: false` if you prefer explicit imports.

#### 2. Inject the client

Use the `@InjectAIGateway()` decorator to inject the configured `AIGatewayClient`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectAIGateway } from '@macpaw/ai-sdk/nestjs';
import type { AIGatewayClient } from '@macpaw/ai-sdk/client';

@Injectable()
export class ChatService {
  constructor(@InjectAIGateway() private readonly ai: AIGatewayClient) {}

  async complete(messages: Array<{ role: string; content: string }>) {
    return this.ai.chat.completions.create({
      model: 'openai/gpt-4.1-nano',
      messages: messages as any,
    });
  }

  streamChat(messages: Array<{ role: string; content: string }>) {
    return this.ai.chat.completions.stream({
      model: 'openai/gpt-4.1-nano',
      messages: messages as any,
    });
  }
}
```

#### 3. Exception filter

The `AIGatewayExceptionFilter` automatically maps `AIGatewayError` to structured HTTP responses:

```ts
import { Controller, Post, Body, UseFilters } from '@nestjs/common';
import { AIGatewayExceptionFilter } from '@macpaw/ai-sdk/nestjs';
import { ChatService } from './chat.service';

@Controller('chat')
@UseFilters(AIGatewayExceptionFilter)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() body: { messages: Array<{ role: string; content: string }> }) {
    return this.chatService.complete(body.messages);
  }
}
```

Or apply it globally:

```ts
import { NestFactory } from '@nestjs/core';
import { AIGatewayExceptionFilter } from '@macpaw/ai-sdk/nestjs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AIGatewayExceptionFilter());
  await app.listen(3000);
}
bootstrap();
```

The filter returns JSON like:

```json
{
  "statusCode": 402,
  "error": "INSUFFICIENT_CREDITS",
  "message": "Not enough credits to complete request",
  "requestId": "abc-123",
  "paymentUrl": "https://pay.example.com/upgrade"
}
```

Optional fields (`requestId`, `paymentUrl`, `retryAfter`) are included only when present.
For 429 responses, the filter also sets the `Retry-After` HTTP header.

#### 4. Custom options factory (useClass)

For complex configuration scenarios, implement `AIGatewayOptionsFactory`:

```ts
import { Injectable } from '@nestjs/common';
import { AIGatewayOptionsFactory, AIGatewayModuleOptions } from '@macpaw/ai-sdk/nestjs';

@Injectable()
export class AIGatewayConfigService implements AIGatewayOptionsFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  createAIGatewayOptions(): AIGatewayModuleOptions {
    return {
      env: this.config.get('AI_GATEWAY_ENV'),
      getAuthToken: (forceRefresh) => this.authService.getToken(forceRefresh),
      logger: this.logger,
    };
  }
}
```

```ts
AIGatewayModule.forRootAsync({
  imports: [ConfigModule, AuthModule],
  useClass: AIGatewayConfigService,
});
```

## Testing

The SDK ships a dedicated `@macpaw/ai-sdk/testing` entry point with a fully-mocked client, framework-agnostic mock functions, and streaming helpers.

```ts
import {
  createMockAIGatewayClient,
  createMockChatCompletion,
  createMockStreamTextResult,
  createMockStreamResponseResult,
} from '@macpaw/ai-sdk/testing';
```

### Mock client

`createMockAIGatewayClient()` returns a `MockAIGatewayClient` where every API method is a `MockFn` — no test framework dependency required.

```ts
const client = createMockAIGatewayClient();

// Use fixture helpers — no boilerplate
client.chat.completions.create.mockResolvedValue(createMockChatCompletion({ content: 'Hi!' }));

// Use in code under test
const result = await client.chat.completions.create({ model: 'gpt-4.1-nano', messages: [] });

// Assert
expect(client.chat.completions.create.callCount).toBe(1);
expect(client.chat.completions.create.wasCalled).toBe(true);
expect(client.chat.completions.create.wasCalledWith({ model: 'gpt-4.1-nano', messages: [] })).toBe(true);
```

All endpoints are covered:

| Namespace              | Mock methods                       |
| ---------------------- | ---------------------------------- |
| `chat.completions`     | `create`, `stream`                 |
| `responses`            | `create`, `createStream`, `stream` |
| `embeddings`           | `create`                           |
| `models`               | `getInfo`                          |
| `images`               | `generate`, `edit`                 |
| `audio.transcriptions` | `create`                           |
| `audio.translations`   | `create`                           |
| (root)                 | `use`                              |

### Response fixture helpers

Pre-built factories that eliminate boilerplate — just pass the fields you care about:

```ts
import {
  createMockChatCompletion,
  createMockResponseObject,
  createMockEmbeddingResponse,
  createMockImageResponse,
  createMockTranscriptionResponse,
  createMockTranslationResponse,
  createMockModelInfoResponse,
} from '@macpaw/ai-sdk/testing';

client.chat.completions.create.mockResolvedValue(createMockChatCompletion({ content: 'Hello' }));
client.responses.create.mockResolvedValue(createMockResponseObject({ content: 'World' }));
client.embeddings.create.mockResolvedValue(createMockEmbeddingResponse({ embeddings: [[0.1, 0.2]] }));
client.images.generate.mockResolvedValue(createMockImageResponse({ urls: ['https://example.com/cat.png'] }));
client.audio.transcriptions.create.mockResolvedValue(createMockTranscriptionResponse({ text: 'Hello world' }));
client.audio.translations.create.mockResolvedValue(createMockTranslationResponse({ text: 'Translated' }));
client.models.getInfo.mockResolvedValue(createMockModelInfoResponse({ models: [{ name: 'gpt-4.1-nano' }] }));
```

All fixtures return fully-typed objects with sensible defaults — call with no arguments for a valid default.

### MockFn API

Each mock method exposes:

| Property / Method             | Description                                       |
| ----------------------------- | ------------------------------------------------- |
| `.calls`                      | Array of all calls (each entry = arguments array) |
| `.callCount`                  | Number of times called                            |
| `.lastCall`                   | Arguments of the last call                        |
| `.wasCalled`                  | `true` if called at least once                    |
| `.wasCalledWith(...args)`     | `true` if any call matched the given arguments    |
| `.mockReturnValue(v)`         | Set a fixed synchronous return value              |
| `.mockReturnValueOnce(v)`     | Set return value for the _next_ call only         |
| `.mockResolvedValue(v)`       | Set a fixed promised return value                 |
| `.mockResolvedValueOnce(v)`   | Set resolved value for the _next_ call only       |
| `.mockRejectedValue(e)`       | Set a fixed rejected promise                      |
| `.mockRejectedValueOnce(e)`   | Set rejected value for the _next_ call only       |
| `.mockImplementation(fn)`     | Custom implementation                             |
| `.mockImplementationOnce(fn)` | Custom implementation for the _next_ call only    |
| `.mockClear()`                | Clear call history, keep implementation           |
| `.mockReset()`                | Clear history, once-queue, and implementation     |

#### Sequential return values

```ts
client.chat.completions.create
  .mockResolvedValueOnce(createMockChatCompletion({ content: 'first' }))
  .mockResolvedValueOnce(createMockChatCompletion({ content: 'second' }))
  .mockResolvedValue(createMockChatCompletion({ content: 'default' }));

// 1st call → 'first', 2nd → 'second', 3rd+ → 'default'
```

#### Error testing

```ts
import { AuthError } from '@macpaw/ai-sdk';

client.chat.completions.create.mockRejectedValue(new AuthError('Token expired', 401));

await expect(service.complete(messages)).rejects.toThrow('Token expired');
```

### Stream mocks

For testing streaming code paths, use the stream helpers:

```ts
// Chat streaming
client.chat.completions.stream.mockReturnValue(
  createMockStreamTextResult({
    text: ['Hello', ' world'],
    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
  }),
);

const result = client.chat.completions.stream({ model: 'm', messages: [] });
for await (const delta of result.textStream) {
  console.log(delta); // 'Hello', ' world'
}
const fullText = await result.text; // 'Hello world'

// Response streaming
client.responses.stream.mockReturnValue(createMockStreamResponseResult('Streamed response'));
```

Both helpers accept a simple string for quick tests or an options object for custom chunking and usage stats.

The returned object extends the standard result with an `aborted` flag for cancellation assertions:

```ts
const streamResult = createMockStreamTextResult('test');
streamResult.abort();
expect(streamResult.aborted).toBe(true);
```

### Reset and clear

```ts
client.mockResetAll(); // clears calls, once-queues, and implementations for ALL endpoints

// Per-method:
client.chat.completions.create.mockClear(); // clears calls only, keeps implementation
client.chat.completions.create.mockReset(); // clears calls + resets implementation
```

### Mock transport (integration tests)

For integration tests where you want the **real client pipeline** (auth, middleware, retry) but **no network**, use `createMockTransport()`:

```ts
import { createAIGatewayClient } from '@macpaw/ai-sdk/client';
import { createMockTransport } from '@macpaw/ai-sdk/testing';

const transport = createMockTransport();
const client = createAIGatewayClient({
  env: 'production',
  getAuthToken: async () => 'test-token',
  transport,
});

// Production code — works without network
const completion = await client.chat.completions.create({
  model: 'openai/gpt-4.1-nano',
  messages: [{ role: 'user', content: 'Hi' }],
});
console.log(completion.choices[0]?.message?.content); // 'Mock response'

// Inspect captured requests
console.log(transport.requestCount); // 1
console.log(transport.requests[0].body); // { model: '...', messages: [...] }
```

Every endpoint returns a sensible default fixture automatically. Override specific routes when needed:

```ts
// Simulate a 503 for chat
transport.onRoute('/chat/completions', () => new Response(JSON.stringify({ error: 'overloaded' }), { status: 503 }));

// Catch-all fallback for unmatched routes
transport.onAny((_config, body) => new Response(JSON.stringify({ echo: body }), { status: 200 }));

// Reset handlers and request history
transport.reset();
```

### NestJS testing

For NestJS integration tests, use the mock client with the injection token:

```ts
import { Test } from '@nestjs/testing';
import { AI_GATEWAY_CLIENT } from '@macpaw/ai-sdk/nestjs';
import { createMockAIGatewayClient } from '@macpaw/ai-sdk/testing';

const mockClient = createMockAIGatewayClient();

const module = await Test.createTestingModule({
  providers: [ChatService, { provide: AI_GATEWAY_CLIENT, useValue: mockClient }],
}).compile();

const service = module.get(ChatService);
mockClient.chat.completions.create.mockResolvedValue({
  /* ... */
});
const result = await service.complete([{ role: 'user', content: 'Hi' }]);
```

## AI coding assistant integration

This SDK ships with templates and a setup script for **Cursor**, **Claude Code**, and **OpenAI Codex** so that AI assistants automatically follow the correct integration patterns when you ask them to "add AI Gateway" or "integrate chat with MacPaw AI".

| Tool             | What gets set up                               | How it works                                            |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------- |
| **Cursor**       | `.cursor/skills/integrate-ai-gateway/SKILL.md` | Cursor Skill — auto-applied when you mention AI Gateway |
| **Claude Code**  | `CLAUDE.md`                                    | Read automatically by Claude Code from repo root        |
| **OpenAI Codex** | `AGENTS.md`                                    | Read automatically by Codex from repo root              |

### Quick setup (recommended)

After `pnpm add @macpaw/ai-sdk` (or `npm install @macpaw/ai-sdk`), run one command to set up all three tools at once:

```bash
pnpm exec macpaw-ai-setup
# or: npx macpaw-ai-setup
```

This copies the Cursor skill, creates `CLAUDE.md` for Claude Code, and creates `AGENTS.md` for OpenAI Codex. If your project already has its own `CLAUDE.md` or `AGENTS.md`, the AI Gateway instructions are appended (not overwritten).

To set up a specific tool only:

```bash
pnpm exec macpaw-ai-setup cursor   # Cursor skill only
pnpm exec macpaw-ai-setup claude   # Claude Code only
pnpm exec macpaw-ai-setup codex    # OpenAI Codex only
```

Then ask in natural language: _"Add AI Gateway chat to this Next.js app"_ or _"Integrate NestJS with AI Gateway using the official SDK."_

> **Tip:** Copy the Cursor skill to `~/.cursor/skills/integrate-ai-gateway/` to make it available in every project.

## Subpath exports

> **Note:** `@macpaw/ai-sdk/provider` is the recommended app-developer entry point. `@macpaw/ai-sdk/client` is the focused low-level client path. `@macpaw/ai-sdk/runtime` is the explicit advanced runtime surface. `@macpaw/ai-sdk/core` remains a compatibility facade and may change more aggressively.

| Import path               | Content                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `@macpaw/ai-sdk`          | Root convenience entry: Vercel-compatible provider surface plus shared errors, enums, and helpers |
| `@macpaw/ai-sdk/client`   | Advanced low-level Gateway HTTP client for direct API usage and multipart flows                   |
| `@macpaw/ai-sdk/types`    | Domain TypeScript types (OpenAI-compatible request/response shapes)                               |
| `@macpaw/ai-sdk/runtime`  | Advanced runtime primitives: transport, config, validation, request execution, SSE, retry         |
| `@macpaw/ai-sdk/core`     | Runtime compatibility facade (**advanced/internal**; no domain type barrel)                       |
| `@macpaw/ai-sdk/provider` | Curated Vercel AI SDK surface plus AI Gateway provider/fetch/dual-provider helpers                |
| `@macpaw/ai-sdk/nestjs`   | NestJS module, decorator, exception filter                                                        |
| `@macpaw/ai-sdk/testing`  | Provider and client-oriented mocks, fixtures, stream helpers, mock transport                      |

## Versioning policy

This project follows [Semantic Versioning](https://semver.org/):

| Change type          | Semver  | Examples                                                                             |
| -------------------- | ------- | ------------------------------------------------------------------------------------ |
| **Breaking** (major) | `x.0.0` | Removing/renaming exports, changing method signatures, dropping Node version support |
| **Feature** (minor)  | `0.x.0` | New API endpoint, new config option, new testing helper                              |
| **Fix** (patch)      | `0.0.x` | Bug fix, docs update, internal refactor with no public API change                    |

Releases are automated via [semantic-release](https://github.com/semantic-release/semantic-release) based on [Conventional Commits](https://www.conventionalcommits.org/). Use `feat:`, `fix:`, `perf:`, and `BREAKING CHANGE:` in commit messages — the CI handles versioning, changelog, npm publish, and GitHub releases.

## License

MIT © 2026 [MacPaw Way Ltd](https://macpaw.com). See [LICENSE](LICENSE) for details.
