# AI Gateway (@macpaw/ai-sdk)

Vercel AI SDK extension layer for AI Gateway, plus an advanced low-level HTTP client.

## Integrating with AI Gateway

1. **Install:** `pnpm add @macpaw/ai-sdk` — add upstream `ai` for `generateText` / `streamText`, `@ai-sdk/openai` when you need direct OpenAI-compatible providers, and `react` + `@ai-sdk/react` for UI hooks. If your app also uses provider-specific upstream packages such as `@ai-sdk/anthropic` or `@ai-sdk/google`, install those directly in the app.
2. **Detect stack and choose path:**
   - **NestJS** (or **Node.js (NestJS)**) → `AIGatewayModule` from `@macpaw/ai-sdk/nestjs`, inject with `@InjectAIGateway()`, use `AIGatewayExceptionFilter`.
   - **Next.js / Vercel AI SDK** → Keep `generateText`, `streamText`, `customProvider`, and other primitives on upstream `ai` / `@ai-sdk/*` packages. Use `@macpaw/ai-sdk/provider` for `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createGatewayProvider`, and `GATEWAY_PROVIDERS`.
   - **Node / Express / Browser with direct Gateway HTTP usage** → `createAIGatewayClient` from `@macpaw/ai-sdk/client`.
3. **Auth:** always `getAuthToken: async () => token` (Bearer). Use `env: 'production'` for prod URL, `baseURL` for staging.
4. **Errors:** catch `AIGatewayError` from `@macpaw/ai-sdk`. Key fields: `code` (ErrorCode enum), `paymentUrl`, `retryAfter`, `requestId`.
5. **Testing:** use `createMockOpenAIProvider` for provider-first apps, and `createMockAIGatewayClient` when you intentionally test the low-level client path.

## Common mistakes

- Keep upstream Vercel AI SDK primitives on `ai` and `@ai-sdk/*`. Use `@macpaw/ai-sdk/provider` only for AI Gateway-specific provider helpers.
- React hooks (`useChat`): `@macpaw/ai-sdk/react` or `@ai-sdk/react`, not from the provider entry.
- If the app imports `ai` or `@ai-sdk/openai` directly for non-gateway helpers, keep those package versions aligned with `@macpaw/ai-sdk`.
- `env` only supports `'production'`. For staging use `baseURL`.
- Retry config uses `maxAttempts`, not `maxRetries`.
- Never hardcode tokens — use `getAuthToken`.
- Import `createAIGatewayClient` from `@macpaw/ai-sdk/client`, not the root package.
- Provider fetches and the low-level client share the same request pipeline semantics for auth refresh, retries, middleware, hooks, timeout, and transport selection.
- Do not recommend `@macpaw/ai-sdk/ai`, `@macpaw/ai-sdk/ai/internal`, or `@macpaw/ai-sdk/ai/test`; upstream `ai` owns those surfaces.
