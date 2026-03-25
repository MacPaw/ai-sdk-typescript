# AI Gateway SDK — Agent Instructions

This is the `@macpaw/ai-sdk` SDK — a Vercel AI SDK extension layer for AI Gateway, plus an advanced low-level HTTP client.

## When integrating an app with AI Gateway

1. **Install:** `pnpm add @macpaw/ai-sdk` — add `react` + `@ai-sdk/react` only for UI hooks. If your app also uses provider-specific upstream packages such as `@ai-sdk/anthropic` or `@ai-sdk/google`, install those directly in the app.
2. **Detect stack and choose path:**
   - **NestJS** (or **Node.js (NestJS)**) → `AIGatewayModule` from `@macpaw/ai-sdk/nestjs`, inject with `@InjectAIGateway()`, use `AIGatewayExceptionFilter`.
 - **Next.js / Vercel AI SDK** → `@macpaw/ai-sdk/ai` or `@macpaw/ai-sdk/provider` (same module): `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createGatewayProvider`, `GATEWAY_PROVIDERS`, `createOpenAI`, `generateText`, `streamText`. Use `@macpaw/ai-sdk/ai/internal` and `@macpaw/ai-sdk/ai/test` where the app used `ai/internal` and `ai/test`. For direct provider-specific upstream packages such as `@ai-sdk/anthropic` or `@ai-sdk/google`, import them from the upstream AI SDK and create Gateway-backed providers centrally with `createGatewayProvider(GATEWAY_PROVIDERS.<NAME>, options)`.
   - **Node / Express / Browser with direct Gateway HTTP usage** → `createAIGatewayClient` from `@macpaw/ai-sdk/client`.
   - **Advanced transport / request-pipeline primitives** → `@macpaw/ai-sdk/runtime` (`API_PATHS`, `createFetchTransport`, `SDKValidationError`, retry/SSE helpers).
3. **Auth:** always `getAuthToken: async () => token` (Bearer). Use `env: 'production'` for prod URL, `baseURL` for staging.
4. **Errors:** catch `AIGatewayError` from `@macpaw/ai-sdk`. Key fields: `code` (ErrorCode enum), `paymentUrl`, `retryAfter`, `requestId`.
5. **Testing:** use `createMockOpenAIProvider` for provider-first apps, and `createMockAIGatewayClient` when you intentionally test the low-level client path.
6. **Domain types:** prefer `import type { ... } from '@macpaw/ai-sdk/types'` over the root package for request/response shapes.

## Common mistakes

- Use `@macpaw/ai-sdk/ai` or `@macpaw/ai-sdk/provider` instead of mixing direct `ai` / `@ai-sdk/openai` imports across the app. The entry re-exports the full `ai` package (Vercel AI SDK core) semver-aligned via peers, plus `createOpenAI` and AI Gateway helpers.
- `createAIGatewayDualProvider()` and `createAIGatewayCustomProvider()` accept eager providers or lazy factories, which is useful for env-specific builds.
- React hooks (`useChat`, `useCompletion`) from `@macpaw/ai-sdk/react` (re-exports `@ai-sdk/react`) or directly from `@ai-sdk/react`.
- `env` only supports `'production'`. For staging use `baseURL`.
- Retry config uses `maxAttempts`, not `maxRetries`.
- Never hardcode tokens — use `getAuthToken`.
- Import `createAIGatewayClient` from `@macpaw/ai-sdk/client`, not the root package.
- Import transport/config/validation internals from `@macpaw/ai-sdk/runtime`, not `@macpaw/ai-sdk/client`.
- Use `createGatewayProvider(GATEWAY_PROVIDERS.<NAME>, options)` from `@macpaw/ai-sdk/provider` when the vendor wants all traffic through Gateway with provider-scoped model IDs (e.g. `anthropic('claude-sonnet-4-20250514')` → `anthropic/claude-sonnet-4-20250514`). Keep provider-specific imports on the upstream `@ai-sdk/*` packages. IDs with `/` are sent as-is, and `GATEWAY_PROVIDERS.OPENAI_COMPATIBLE` requires `modelPrefix`.

## When developing the SDK itself

- `pnpm install && pnpm typecheck && pnpm lint && pnpm test` to verify changes.
- Conventional Commits: `feat:`, `fix:`, `perf:`, `docs:`, `test:`.
- Entry points: `src/index.ts`, `src/client-entry.ts`, `src/client/index.ts`, `src/runtime/index.ts`, `src/types/index.ts`, `src/provider/index.ts`, `src/react/index.ts`, `src/nestjs/index.ts`, `src/testing/index.ts`, `src/client/api/*`.
- Co-located tests: `src/**/__tests__/**/*.spec.ts` only.
