# AI Gateway SDK — Agent Instructions

This is the `@macpaw/ai-sdk` SDK — a Vercel AI SDK extension layer for AI Gateway, plus an advanced low-level HTTP client.

## When integrating an app with AI Gateway

1. **Install:** `pnpm add @macpaw/ai-sdk` — no other AI packages needed unless you use React hooks from `@ai-sdk/react`.
2. **Detect stack and choose path:**
   - **NestJS** (or **Node.js (NestJS)**) → `AIGatewayModule` from `@macpaw/ai-sdk/nestjs`, inject with `@InjectAIGateway()`, use `AIGatewayExceptionFilter`.
   - **Next.js / Vercel AI SDK** → `@macpaw/ai-sdk/provider` as the primary path: `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createOpenAI`, `generateText`, `streamText`.
   - **Node / Express / Browser with direct Gateway HTTP usage** → `createAIGatewayClient` from `@macpaw/ai-sdk/client`.
   - **Advanced transport / request-pipeline primitives** → `@macpaw/ai-sdk/runtime` (`API_PATHS`, `createFetchTransport`, `SDKValidationError`, retry/SSE helpers).
3. **Auth:** always `getAuthToken: async () => token` (Bearer). Use `env: 'production'` for prod URL, `baseURL` for staging.
4. **Errors:** catch `AIGatewayError` from `@macpaw/ai-sdk`. Key fields: `code` (ErrorCode enum), `paymentUrl`, `retryAfter`, `requestId`.
5. **Testing:** use `createMockOpenAIProvider` for provider-first apps, and `createMockAIGatewayClient` when you intentionally test the low-level client path.
6. **Domain types:** prefer `import type { ... } from '@macpaw/ai-sdk/types'` over the root package for request/response shapes.

## Common mistakes

- Use `@macpaw/ai-sdk/provider` instead of mixing direct `ai` / `@ai-sdk/openai` imports across the app. The provider entry exposes the curated AI SDK surface we support semver-wise, plus `createOpenAI` for dual-backend flows.
- React hooks (`useChat`, `useCompletion`) still come from the Vercel AI SDK React package such as `@ai-sdk/react`.
- `env` only supports `'production'`. For staging use `baseURL`.
- Retry config uses `maxAttempts`, not `maxRetries`.
- Never hardcode tokens — use `getAuthToken`.
- Import `createAIGatewayClient` from `@macpaw/ai-sdk/client`, not the root package.
- Import transport/config/validation internals from `@macpaw/ai-sdk/runtime`, not `@macpaw/ai-sdk/client`.

## When developing the SDK itself

- `pnpm install && pnpm typecheck && pnpm lint && pnpm test` to verify changes.
- Conventional Commits: `feat:`, `fix:`, `perf:`, `docs:`, `test:`.
- Entry points: `src/index.ts`, `src/client-entry.ts`, `src/client/index.ts`, `src/runtime/index.ts`, `src/types/index.ts`, `src/core/index.ts`, `src/provider/index.ts`, `src/nestjs/index.ts`, `src/testing/index.ts`, `src/client/api/*`.
- Co-located tests: `src/**/__tests__/**/*.spec.ts` only.
