# @macpaw/ai-sdk — AI Gateway Integration

Use this guidance when integrating MacPaw AI Gateway into this project.

## Rules

- Use `@macpaw/ai-sdk` for `createAIGatewayProvider`, `createGatewayProvider`, `createGatewayFetch`, errors, and `GatewayProviderSettings`.
- Use `@macpaw/ai-sdk/nestjs` for `AIGatewayModule`, `@InjectAIGateway()`, and `AIGatewayExceptionFilter`.
- Keep generation primitives on upstream `ai` / `@ai-sdk/*`.
- Install `@ai-sdk/openai` when using `createAIGatewayProvider` or `createGatewayProvider`; those paths depend on the OpenAI-compatible provider package.
- Do not use `createAIGatewayClient`, `@macpaw/ai-sdk/client`, `runtime`, `types`, or `testing`; those surfaces do not exist.
- For UI hooks or schema helpers, follow the versioned upstream docs for the installed `ai` / `@ai-sdk/react` major version; this package does not redefine those APIs.

## Guardrails

- Do not invent a token source. If server-side token retrieval is unclear, ask one concise question.
- Do not put real gateway tokens in browser-only code.
- Use `env: 'production'` only for the default MacPaw host. Use `baseURL` for staging or custom hosts.
- `createGatewayFetch` requires a resolved `baseURL`; do not pass only `env`. Prefer `resolveGatewayBaseURL()` when you want the default production host.
- Remove old provider dependencies only after verifying there are no remaining usages.

## Preferred paths

- NestJS: register `AIGatewayModule.forRoot()` / `forRootAsync()`, inject `GatewayProviderSettings` via `@InjectAIGateway()`, build the provider inside services.
- Next.js / Vercel AI SDK: keep `generateText`, `streamText`, hooks, and other Vercel APIs on `ai`; swap only the model provider to `createAIGatewayProvider`.
- Raw server HTTP or multipart: use `createGatewayFetch`.

## Minimal examples

```ts
const gateway = createAIGatewayProvider({
  env: 'production',
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});
```

```ts
const gatewayFetch = createGatewayFetch({
  baseURL: process.env.AI_GATEWAY_BASE_URL ?? 'https://api.macpaw.com/ai',
  getAuthToken: async () => process.env.AI_GATEWAY_TOKEN ?? null,
});
```

## Error handling

- Prefer `isAIGatewayError(error)` and switch on `ErrorCode`.
- For NestJS, prefer `AIGatewayExceptionFilter`.
- Billing states are `InsufficientCredits` / `SubscriptionExpired`.

## Verification

- Read `package.json` scripts first.
- Run the relevant subset of `typecheck`, `lint`, `test`, and `build`.
- Add one focused smoke path when integrating.
- Report: chosen integration path, files changed, token source, verification run, and any manual env steps left.
- If env variables were added or required, name them explicitly, e.g. `AI_GATEWAY_TOKEN` and `AI_GATEWAY_BASE_URL`.
