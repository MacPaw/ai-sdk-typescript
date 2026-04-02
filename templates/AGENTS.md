# @macpaw/ai-sdk — AI Gateway Instructions

Apply these rules when integrating MacPaw AI Gateway.

## Use the correct package surface

- `@macpaw/ai-sdk`: `createAIGatewayProvider`, `createGatewayProvider`, `createGatewayFetch`, errors, `GatewayProviderSettings`.
- `@macpaw/ai-sdk/provider`: compatibility alias only.
- `@macpaw/ai-sdk/nestjs`: NestJS module and decorators.
- Install `@ai-sdk/openai` when using `createAIGatewayProvider` or `createGatewayProvider`.
- Never use `createAIGatewayClient`, `@macpaw/ai-sdk/client`, `runtime`, `types`, or `testing`.
- For UI hooks or schema helpers, follow the versioned upstream docs for the installed `ai` / `@ai-sdk/react` major version; this package does not redefine those APIs.

## Choose one integration path

- NestJS app: use `AIGatewayModule` and `@InjectAIGateway()`.
- Next.js / Vercel AI SDK app: keep generation on `ai`, replace only the model provider.
- Raw server or multipart HTTP flow: use `createGatewayFetch`.
- Existing `openai` / `@ai-sdk/openai` / `@anthropic-ai/sdk` usage: treat as migration.

## Guardrails

- Do not invent a token source. Ask once if unclear.
- Do not place gateway tokens in browser-only code.
- `env` supports only `'production'`; use `baseURL` for staging/custom hosts.
- `createGatewayFetch` requires a resolved `baseURL`; prefer `resolveGatewayBaseURL()` when you want the default production host.
- Remove legacy imports and dependencies only after confirming all usages are migrated.

## Canonical snippets

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

## Error handling and verification

- Use `isAIGatewayError(error)` with `ErrorCode`.
- Prefer `AIGatewayExceptionFilter` in NestJS.
- Read available scripts from `package.json` before running checks.
- Run the relevant subset of `typecheck`, `lint`, `test`, and `build`.
- Report the chosen path, changed files, token source, checks run, and remaining manual steps.
- If env variables were added or required, name them explicitly, e.g. `AI_GATEWAY_TOKEN` and `AI_GATEWAY_BASE_URL`.
