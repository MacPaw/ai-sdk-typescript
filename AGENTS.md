# AI Gateway SDK — Agent Instructions

This is the `@macpaw/ai-sdk` SDK — a Vercel AI SDK extension layer for AI Gateway, plus an advanced low-level HTTP client.

## When integrating an app with AI Gateway

1. **Install:** `pnpm add @macpaw/ai-sdk` — add upstream `ai` for `generateText` / `streamText`, `@ai-sdk/openai` when you need direct OpenAI-compatible providers, and `react` + `@ai-sdk/react` only for UI hooks. If your app also uses provider-specific upstream packages such as `@ai-sdk/anthropic` or `@ai-sdk/google`, install those directly in the app.
2. **Detect stack and choose path:**
   - **NestJS** (or **Node.js (NestJS)**) → `AIGatewayModule` from `@macpaw/ai-sdk/nestjs`, inject with `@InjectAIGateway()`, use `AIGatewayExceptionFilter`.
   - **Next.js / Vercel AI SDK** → Keep `generateText`, `streamText`, `customProvider`, and other primitives on upstream `ai` / `@ai-sdk/*` packages. Use `@macpaw/ai-sdk/provider` for `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createGatewayProvider`, and `GATEWAY_PROVIDERS`.
   - **Node / Express / Browser with direct Gateway HTTP usage** → `createAIGatewayClient` from `@macpaw/ai-sdk/client`.
   - **Advanced transport / request-pipeline primitives** → `@macpaw/ai-sdk/runtime` (`API_PATHS`, `createFetchTransport`, `SDKValidationError`, retry/SSE helpers).
3. **Auth:** always `getAuthToken: async () => token` (Bearer). Use `env: 'production'` for prod URL, `baseURL` for staging.
4. **Errors:** catch `AIGatewayError` from `@macpaw/ai-sdk`. Key fields: `code` (ErrorCode enum), `paymentUrl`, `retryAfter`, `requestId`.
5. **Testing:** use `createMockOpenAIProvider` for provider-first apps, and `createMockAIGatewayClient` when you intentionally test the low-level client path.
6. **Domain types:** prefer `import type { ... } from '@macpaw/ai-sdk/types'` over the root package for request/response shapes.

## Common mistakes

- Keep upstream Vercel AI SDK primitives on `ai` and `@ai-sdk/*`. Use `@macpaw/ai-sdk/provider` only for AI Gateway-specific provider helpers.
- `createAIGatewayDualProvider()` and `createAIGatewayCustomProvider()` accept eager providers or lazy factories, which is useful for env-specific builds.
- React hooks (`useChat`, `useCompletion`) from `@macpaw/ai-sdk/react` (re-exports `@ai-sdk/react`) or directly from `@ai-sdk/react`.
- `env` only supports `'production'`. For staging use `baseURL`.
- Retry config uses `maxAttempts`, not `maxRetries`.
- Never hardcode tokens — use `getAuthToken`.
- Import `createAIGatewayClient` from `@macpaw/ai-sdk/client`, not the root package.
- Import transport/config/validation internals from `@macpaw/ai-sdk/runtime`, not `@macpaw/ai-sdk/client`.
- Provider fetches and the low-level client share the same request pipeline semantics for auth refresh, retries, middleware, hooks, timeout, and transport selection.
- Do not recommend `@macpaw/ai-sdk/ai`, `@macpaw/ai-sdk/ai/internal`, or `@macpaw/ai-sdk/ai/test`; upstream `ai` owns those surfaces.
- Use `createGatewayProvider(GATEWAY_PROVIDERS.<NAME>, options)` from `@macpaw/ai-sdk/provider` when the vendor wants all traffic through Gateway with provider-scoped model IDs (e.g. `anthropic('claude-sonnet-4-20250514')` → `anthropic/claude-sonnet-4-20250514`). Keep provider-specific imports on the upstream `@ai-sdk/*` packages. IDs with `/` are sent as-is, and `GATEWAY_PROVIDERS.OPENAI_COMPATIBLE` requires `modelPrefix`.

## When developing the SDK itself

- `pnpm install && pnpm typecheck && pnpm lint && pnpm test` to verify changes.
- Conventional Commits: `feat:`, `fix:`, `perf:`, `docs:`, `test:`.
- Entry points: `src/index.ts`, `src/client-entry.ts`, `src/client/index.ts`, `src/runtime/index.ts`, `src/types/index.ts`, `src/provider/index.ts`, `src/react/index.ts`, `src/nestjs/index.ts`, `src/testing/index.ts`, `src/client/api/*`.
- Co-located tests: `src/**/__tests__/**/*.spec.ts` only.
