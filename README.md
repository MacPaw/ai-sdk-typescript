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
- **Tree-shakeable** — Zero runtime dependencies, ESM + CJS
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
```

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

## Subpath exports

| Import path | Content |
|---|---|
| `@macpaw/ai` | Main client, types, errors, `ErrorCode` enum |
| `@macpaw/ai/core` | Core types, errors, config, retry, SSE parser |
| `@macpaw/ai/provider` | Vercel AI SDK provider + re-exports (`generateText`, `streamText`, …) |
| `@macpaw/ai/nestjs` | NestJS module, decorator, exception filter |

## License

Proprietary.
