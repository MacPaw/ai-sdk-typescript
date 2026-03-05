# ai-sdk
Official TypeScript SDK for AI Gateway - universal client for browser and Node.js (Chat, Embeddings, Images, Audio, NestJS module)
# @macpaw/ai

Commercial Web SDK for the AI Gateway. Universal TypeScript client for browser and Node.js with streaming, retry, middleware, observability hooks, and normalized errors.

## Features

- **Universal** — Works in browser and Node.js 18+
- **Streaming** — SSE parsing for chat, responses, and audio transcription APIs
- **Rich stream results** — `.stream()` returns `textStream`, `text` promise, and `abort()` (AI SDK-inspired)
- **Full API coverage** — Chat, Responses, Embeddings, Images, Audio, Models
- **Retry** — Exponential backoff for 429 and 5xx (never retries 402/401)
- **Middleware** — Request interceptors for logging, metrics, custom headers
- **Lifecycle hooks** — `onRequest`, `onResponse`, `onError`, `onRetry`
- **Error normalization** — BFF and OpenAI-format errors mapped to stable `ErrorCode` enum
- **Auth** — Pluggable `getAuthToken()` for Setapp Bearer token
- **Request ID tracking** — Automatic `X-Request-ID` generation
- **AbortController** — Per-request signal and configurable timeout
- **Typed** — Full TypeScript types, const-object enums for all codes/roles
- **Tree-shakeable** — ESM + CJS with minimal runtime dependencies
- **Vercel AI SDK** — First-class provider integration

## Install

```bash
pnpm add @macpaw/ai
# or
npm install @macpaw/ai
```

## Quick start

```ts
import { createAIGatewayClient, ErrorCode } from '@macpaw/ai';

const client = createAIGatewayClient({
  env: 'production',
  getAuthToken: async () => (await getSetappSession()).accessToken,
});

// Non-streaming
const completion = await client.chat.completions.create({
  model: 'openai/gpt-4.1-nano',
  messages: [{ role: 'user', content: 'Hello' }],
});
console.log(completion.choices[0]?.message?.content);

// Rich streaming (AI SDK-inspired)
const result = client.chat.completions.stream({
  model: 'openai/gpt-4.1-nano',
  messages: [{ role: 'user', content: 'Write a poem' }],
});
for await (const delta of result.textStream) {
  process.stdout.write(delta);
}
const fullText = await result.text;
```

## Configuration

```ts
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
import { ImageSize } from '@macpaw/ai';

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
import { AudioFormat } from '@macpaw/ai';

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
console.log(models.data.map(m => m.model_name));

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

// Combine multiple abort signals (e.g. user cancel + timeout) — use anySignal from @macpaw/ai
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

The SDK normalizes errors from both BFF and OpenAI proxy formats into `AIGatewayError` with stable codes accessible via the `ErrorCode` const-object enum:

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `ErrorCode.AuthRequired` | 401 | Missing or expired token |
| `ErrorCode.InsufficientCredits` | 402 | Not enough credits |
| `ErrorCode.SubscriptionExpired` | 402 | Subscription expired |
| `ErrorCode.ModelNotAllowed` | 403 | Model access denied |
| `ErrorCode.RateLimited` | 429 | Too many requests |
| `ErrorCode.BadRequest` | 400 | Invalid request |
| `ErrorCode.Validation` | 422 | Field validation error |
| `ErrorCode.InternalServerError` | 500 | Server error |

```ts
import { AIGatewayError, ErrorCode } from '@macpaw/ai';

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
import { ErrorCode, MessageRole, ImageSize, AudioFormat } from '@macpaw/ai';

// Use as values
ErrorCode.AuthRequired     // 'AUTH_REQUIRED'
MessageRole.User           // 'user'
ImageSize.S1024            // '1024x1024'
AudioFormat.VerboseJson    // 'verbose_json'

// Use as types
function handleError(code: ErrorCode) {
  switch (code) {
    case ErrorCode.AuthRequired: // ...
    case ErrorCode.RateLimited:  // ...
  }
}
```

## Custom transport

Replace the default fetch-based transport:

```ts
import { createAIGatewayClient } from '@macpaw/ai';

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

For React apps using Vercel AI SDK (`useChat`, `useCompletion`, `generateText`, `streamText`).
Everything is included — no extra packages needed.

### Option A: High-level provider (recommended)

```ts
import { createAIGatewayProvider, generateText, streamText } from '@macpaw/ai/provider';

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

### Option B: Low-level custom fetch

```ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAIGatewayFetch } from '@macpaw/ai/provider';

const customFetch = createAIGatewayFetch({
  baseURL: 'https://api.macpaw.com/ai',
  getAuthToken: async () => myToken,
});

const openai = createOpenAI({
  baseURL: 'https://api.macpaw.com/ai/api/v1',
  fetch: customFetch,
  apiKey: 'unused',
});
```

> **Note:** `@ai-sdk/openai` and `ai` are bundled as dependencies of `@macpaw/ai`.
> You can still import them directly if needed (e.g. `import { createOpenAI } from '@ai-sdk/openai'`).

### React hooks

```tsx
import { useChat } from '@ai-sdk/react';

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat', // your Next.js API route
  });

  return (
    <div>
      {messages.map(m => (
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
import { createAIGatewayClient, AIGatewayError, ErrorCode } from '@macpaw/ai';

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
import { createAIGatewayClient, AIGatewayError } from '@macpaw/ai';

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
pnpm add @macpaw/ai @nestjs/common rxjs
```

#### 1. Register the module

**Static configuration** (`forRoot`):

```ts
import { Module } from '@nestjs/common';
import { AIGatewayModule } from '@macpaw/ai/nestjs';

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
import { AIGatewayModule } from '@macpaw/ai/nestjs';

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
import { InjectAIGateway } from '@macpaw/ai/nestjs';
import type { AIGatewayClient } from '@macpaw/ai';

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
import { AIGatewayExceptionFilter } from '@macpaw/ai/nestjs';
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
import { AIGatewayExceptionFilter } from '@macpaw/ai/nestjs';
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
import { AIGatewayOptionsFactory, AIGatewayModuleOptions } from '@macpaw/ai/nestjs';

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
})
```

## Testing

The SDK ships a dedicated `@macpaw/ai/testing` entry point with a fully-mocked client, framework-agnostic mock functions, and streaming helpers.

```ts
import {
  createMockAIGatewayClient,
  createMockChatCompletion,
  createMockStreamTextResult,
  createMockStreamResponseResult,
} from '@macpaw/ai/testing';
```

### Mock client

`createMockAIGatewayClient()` returns a `MockAIGatewayClient` where every API method is a `MockFn` — no test framework dependency required.

```ts
const client = createMockAIGatewayClient();

// Use fixture helpers — no boilerplate
client.chat.completions.create.mockResolvedValue(
  createMockChatCompletion({ content: 'Hi!' }),
);

// Use in code under test
const result = await client.chat.completions.create({ model: 'gpt-4.1-nano', messages: [] });

// Assert
expect(client.chat.completions.create.callCount).toBe(1);
expect(client.chat.completions.create.wasCalled).toBe(true);
expect(client.chat.completions.create.wasCalledWith({ model: 'gpt-4.1-nano', messages: [] })).toBe(true);
```

All endpoints are covered:

| Namespace | Mock methods |
|---|---|
| `chat.completions` | `create`, `stream` |
| `responses` | `create`, `createStream`, `stream` |
| `embeddings` | `create` |
| `models` | `getInfo` |
| `images` | `generate`, `edit` |
| `audio.transcriptions` | `create` |
| `audio.translations` | `create` |
| (root) | `use` |

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
} from '@macpaw/ai/testing';

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

| Property / Method | Description |
|---|---|
| `.calls` | Array of all calls (each entry = arguments array) |
| `.callCount` | Number of times called |
| `.lastCall` | Arguments of the last call |
| `.wasCalled` | `true` if called at least once |
| `.wasCalledWith(...args)` | `true` if any call matched the given arguments |
| `.mockReturnValue(v)` | Set a fixed synchronous return value |
| `.mockReturnValueOnce(v)` | Set return value for the *next* call only |
| `.mockResolvedValue(v)` | Set a fixed promised return value |
| `.mockResolvedValueOnce(v)` | Set resolved value for the *next* call only |
| `.mockRejectedValue(e)` | Set a fixed rejected promise |
| `.mockRejectedValueOnce(e)` | Set rejected value for the *next* call only |
| `.mockImplementation(fn)` | Custom implementation |
| `.mockImplementationOnce(fn)` | Custom implementation for the *next* call only |
| `.mockClear()` | Clear call history, keep implementation |
| `.mockReset()` | Clear history, once-queue, and implementation |

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
import { AuthError } from '@macpaw/ai';

client.chat.completions.create.mockRejectedValue(
  new AuthError('Token expired', 401),
);

await expect(service.complete(messages)).rejects.toThrow('Token expired');
```

### Stream mocks

For testing streaming code paths, use the stream helpers:

```ts
// Chat streaming
client.chat.completions.stream.mockReturnValue(
  createMockStreamTextResult({ text: ['Hello', ' world'], usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } }),
);

const result = client.chat.completions.stream({ model: 'm', messages: [] });
for await (const delta of result.textStream) {
  console.log(delta); // 'Hello', ' world'
}
const fullText = await result.text; // 'Hello world'

// Response streaming
client.responses.stream.mockReturnValue(
  createMockStreamResponseResult('Streamed response'),
);
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
client.mockResetAll();  // clears calls, once-queues, and implementations for ALL endpoints

// Per-method:
client.chat.completions.create.mockClear();  // clears calls only, keeps implementation
client.chat.completions.create.mockReset();  // clears calls + resets implementation
```

### Mock transport (integration tests)

For integration tests where you want the **real client pipeline** (auth, middleware, retry) but **no network**, use `createMockTransport()`:

```ts
import { createAIGatewayClient } from '@macpaw/ai';
import { createMockTransport } from '@macpaw/ai/testing';

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
console.log(transport.requestCount);    // 1
console.log(transport.requests[0].body); // { model: '...', messages: [...] }
```

Every endpoint returns a sensible default fixture automatically. Override specific routes when needed:

```ts
// Simulate a 503 for chat
transport.onRoute('/chat/completions', () =>
  new Response(JSON.stringify({ error: 'overloaded' }), { status: 503 }),
);

// Catch-all fallback for unmatched routes
transport.onAny((_config, body) =>
  new Response(JSON.stringify({ echo: body }), { status: 200 }),
);

// Reset handlers and request history
transport.reset();
```

### NestJS testing

For NestJS integration tests, use the mock client with the injection token:

```ts
import { Test } from '@nestjs/testing';
import { AI_GATEWAY_CLIENT } from '@macpaw/ai/nestjs';
import { createMockAIGatewayClient } from '@macpaw/ai/testing';

const mockClient = createMockAIGatewayClient();

const module = await Test.createTestingModule({
  providers: [
    ChatService,
    { provide: AI_GATEWAY_CLIENT, useValue: mockClient },
  ],
}).compile();

const service = module.get(ChatService);
mockClient.chat.completions.create.mockResolvedValue({ /* ... */ });
const result = await service.complete([{ role: 'user', content: 'Hi' }]);
```

## AI coding assistant integration

This SDK ships with instructions for **Cursor**, **Claude Code**, and **OpenAI Codex** so that AI assistants automatically follow the correct integration patterns when you ask them to "add AI Gateway" or "integrate chat with MacPaw AI".

| Tool | What gets set up | How it works |
|------|-----------------|-------------|
| **Cursor** | `.cursor/skills/integrate-ai-gateway/SKILL.md` | Cursor Skill — auto-applied when you mention AI Gateway |
| **Claude Code** | `CLAUDE.md` | Read automatically by Claude Code from repo root |
| **OpenAI Codex** | `AGENTS.md` | Read automatically by Codex from repo root |

### Quick setup (recommended)

After `pnpm add @macpaw/ai` (or `npm install @macpaw/ai`), run one command to set up all three tools at once:

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

Then ask in natural language: *"Add AI Gateway chat to this Next.js app"* or *"Integrate NestJS with AI Gateway using the official SDK."*

> **Tip:** Copy the Cursor skill to `~/.cursor/skills/integrate-ai-gateway/` to make it available in every project.

## Subpath exports

> **Note:** `@macpaw/ai/core` exposes internal APIs (config, retry, SSE parser, etc.). Prefer the main `@macpaw/ai` entry point unless you need low-level control. Core APIs may change between minor versions.

| Import path | Content |
|---|---|
| `@macpaw/ai` | Main client, types, errors, `ErrorCode` enum, `anySignal` |
| `@macpaw/ai/core` | Core types, errors, config, retry, SSE parser (**advanced** — internal APIs) |
| `@macpaw/ai/provider` | Vercel AI SDK provider + re-exports (`generateText`, `streamText`, …) |
| `@macpaw/ai/nestjs` | NestJS module, decorator, exception filter |
| `@macpaw/ai/testing` | Mock client, `MockFn`, fixtures, stream helpers, mock transport |

## Versioning policy

This project follows [Semantic Versioning](https://semver.org/):

| Change type | Semver | Examples |
|---|---|---|
| **Breaking** (major) | `x.0.0` | Removing/renaming exports, changing method signatures, dropping Node version support |
| **Feature** (minor) | `0.x.0` | New API endpoint, new config option, new testing helper |
| **Fix** (patch) | `0.0.x` | Bug fix, docs update, internal refactor with no public API change |

Releases are automated via [semantic-release](https://github.com/semantic-release/semantic-release) based on [Conventional Commits](https://www.conventionalcommits.org/). Use `feat:`, `fix:`, `perf:`, and `BREAKING CHANGE:` in commit messages — the CI handles versioning, changelog, npm publish, and GitHub releases.

## License

MIT © 2026 [MacPaw Way Ltd](https://macpaw.com). See [LICENSE](LICENSE) for details.
