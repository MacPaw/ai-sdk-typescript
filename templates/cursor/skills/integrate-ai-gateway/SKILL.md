---
name: integrate-ai-gateway
description: Integrate applications with AI Gateway using @macpaw/ai-sdk. Use for NestJS, Next.js, Vercel AI SDK, raw fetch migrations, video generation, MacPaw AI, Setapp AI, createAIGatewayProvider, createGatewayFetch, createVideoClient, and AI Gateway auth/error wiring.
---

# AI Gateway Integration (@macpaw/ai-sdk)

## Goal

Detect the app shape, choose one integration path, apply the smallest correct patch, add safe auth/error handling, run verification, and report exact changes.

## Package surface

- Use `@macpaw/ai-sdk` for `createAIGatewayProvider`, `createGatewayProvider`, `createGatewayFetch`, `createVideoClient`, `GATEWAY_PROVIDERS`, errors, and `GatewayProviderSettings`.
- Use `@macpaw/ai-sdk/provider` only as a compatibility alias.
- Use `@macpaw/ai-sdk/nestjs` for `AIGatewayModule`, `@InjectAIGateway()`, and `AIGatewayExceptionFilter`.
- Do not use `createAIGatewayClient`, `@macpaw/ai-sdk/client`, `runtime`, `types`, or `testing`; they do not exist.
- For UI hooks or schema helpers, follow the versioned upstream docs for the installed `ai` / `@ai-sdk/react` major version; this package does not redefine those APIs.

## Guardrails

- Do not invent a token source. If server-side token retrieval is unclear, ask one question.
- Do not place real tokens in browser-only code. Frontend-only apps need a backend/BFF token source.
- Do not remove direct OpenAI/Anthropic paths unless all usages are migrated or the user asked for it.
- Use `baseURL` for staging/custom hosts. `env` supports only `'production'`.
- `createGatewayFetch` requires a resolved `baseURL`; do not pass only `env`. Prefer `resolveGatewayBaseURL()` when you want the default production host.

## Choose one path

- NestJS markers: `@nestjs/common`, `*.module.ts`, decorators -> use `@macpaw/ai-sdk/nestjs` + `@macpaw/ai-sdk`.
- Next.js / Vercel markers: `next`, `ai`, `@ai-sdk/*` -> keep generation on `ai`, swap only the model provider.
- Express/Fastify/Hono/server scripts -> use `createGatewayFetch`, or `ai` + provider if already Vercel-shaped.
- Video generation (create job, poll status, fetch content) -> use `createVideoClient`.
- Existing `openai`, `@ai-sdk/openai`, or `@anthropic-ai/sdk` usage -> treat as migration, not greenfield.

## Canonical patterns

```ts
// Vercel AI SDK
const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});
const result = streamText({ model: gateway('openai/gpt-4o'), messages });
```

```ts
// NestJS
AIGatewayModule.forRootAsync({
  useFactory: () => ({
    env: 'production',
    getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
  }),
});
constructor(@InjectAIGateway() private readonly config: GatewayProviderSettings) {}
```

```ts
// Raw fetch / multipart
const baseURL = process.env.AI_GATEWAY_BASE_URL ?? 'https://api.macpaw.com/ai';
const gatewayFetch = createGatewayFetch({
  baseURL,
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});
```

```ts
// Video generation
const videos = createVideoClient({
  env: 'production',
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});
const job = await videos.create({ model: 'veo-2', prompt: 'A sunset over the ocean' });
```

## Error handling

- Prefer `isAIGatewayError(error)` and switch on `ErrorCode`.
- Use `AIGatewayExceptionFilter` in NestJS.
- Treat `InsufficientCredits` / `SubscriptionExpired` as the billing states; there is no `PaymentRequired`.

## Migration rules

- Keep `generateText`, `streamText`, `embed`, React hooks, and upstream primitives on `ai` / `@ai-sdk/*`.
- Replace direct gateway-bound provider construction with `createAIGatewayProvider` or `createGatewayProvider`.
- Replace raw HTTP gateway calls with `createGatewayFetch`.
- Remove old dependencies only after verifying there are no remaining imports/usages.

## Verification

- Read `package.json` scripts before running commands.
- Prefer `typecheck`, `lint`, `test`, and `build` when available.
- Add one focused smoke path: provider call, route handler, or `fetch` stub.
- Do not claim success without reporting which verification commands actually ran.

## Output contract

- State the chosen path: NestJS, Vercel, or raw fetch.
- List files changed.
- State where the token now comes from.
- State verification run and any manual env step left.
