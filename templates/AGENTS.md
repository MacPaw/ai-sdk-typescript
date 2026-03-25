# AI Gateway (@macpaw/ai-sdk)

Vercel AI SDK extension layer for AI Gateway, plus an advanced low-level HTTP client.

## Integrating with AI Gateway

1. **Install:** `pnpm add @macpaw/ai-sdk` — add `react` + `@ai-sdk/react` for UI hooks. If your app also uses provider-specific upstream packages such as `@ai-sdk/anthropic` or `@ai-sdk/google`, install those directly in the app.
2. **Detect stack and choose path:**
   - **NestJS** (or **Node.js (NestJS)**) → `AIGatewayModule` from `@macpaw/ai-sdk/nestjs`, inject with `@InjectAIGateway()`, use `AIGatewayExceptionFilter`.
   - **Next.js / Vercel AI SDK** → `@macpaw/ai-sdk/ai` or `@macpaw/ai-sdk/provider` (same module): `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createGatewayProvider`, `GATEWAY_PROVIDERS`, `createOpenAI`, `generateText`, `streamText`. Subpaths `@macpaw/ai-sdk/ai/internal`, `@macpaw/ai-sdk/ai/test` replace `ai/internal`, `ai/test`. For direct provider-specific packages such as `@ai-sdk/anthropic` or `@ai-sdk/google`, import them from the upstream AI SDK and create Gateway-backed providers centrally with `createGatewayProvider(GATEWAY_PROVIDERS.<NAME>, options)`.
   - **Node / Express / Browser with direct Gateway HTTP usage** → `createAIGatewayClient` from `@macpaw/ai-sdk/client`.
3. **Auth:** always `getAuthToken: async () => token` (Bearer). Use `env: 'production'` for prod URL, `baseURL` for staging.
4. **Errors:** catch `AIGatewayError` from `@macpaw/ai-sdk`. Key fields: `code` (ErrorCode enum), `paymentUrl`, `retryAfter`, `requestId`.
5. **Testing:** use `createMockOpenAIProvider` for provider-first apps, and `createMockAIGatewayClient` when you intentionally test the low-level client path.

## Common mistakes

- Use `@macpaw/ai-sdk/ai` or `@macpaw/ai-sdk/provider` for gateway-backed setup: it re-exports the full `ai` package plus `createOpenAI` and AI Gateway helpers. Prefer a single import path instead of mixing `ai` and this entry.
- React hooks (`useChat`): `@macpaw/ai-sdk/react` or `@ai-sdk/react`, not from `@macpaw/ai-sdk/ai` / `@macpaw/ai-sdk/provider`.
- If the app imports `ai` or `@ai-sdk/openai` directly for non-gateway helpers, keep those package versions aligned with `@macpaw/ai-sdk`.
- `env` only supports `'production'`. For staging use `baseURL`.
- Retry config uses `maxAttempts`, not `maxRetries`.
- Never hardcode tokens — use `getAuthToken`.
- Import `createAIGatewayClient` from `@macpaw/ai-sdk/client`, not the root package.
- Provider fetches and the low-level client share the same request pipeline semantics for auth refresh, retries, middleware, hooks, timeout, and transport selection.
