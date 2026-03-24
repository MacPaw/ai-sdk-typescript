# AI Gateway SDK — Claude Code Instructions

This is `@macpaw/ai-sdk` — a Vercel AI SDK extension layer for AI Gateway with an explicit advanced HTTP client path.

## Integrating an app with AI Gateway

Install `@macpaw/ai-sdk`. No other AI packages are required unless your app uses React hooks from `@ai-sdk/react`.

| Stack                     | Import from               | Key export                                                                                                                              |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| NestJS / Node.js (NestJS) | `@macpaw/ai-sdk/nestjs`   | `AIGatewayModule.forRootAsync()`, `@InjectAIGateway()`, `AIGatewayExceptionFilter`                                                      |
| Next.js / Vercel AI SDK   | `@macpaw/ai-sdk/provider` | `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createOpenAI`, `generateText`, `streamText` |
| Node / Express / Browser  | `@macpaw/ai-sdk/client`   | `createAIGatewayClient`                                                                                                                 |
| Advanced runtime internals| `@macpaw/ai-sdk/runtime`  | `API_PATHS`, `createFetchTransport`, `SDKValidationError`, retry/SSE/request helpers                                                    |
| Tests                     | `@macpaw/ai-sdk/testing`  | `createMockOpenAIProvider`, `createMockAIGatewayClient`, `createMockChatCompletion`                                                     |
| Errors                    | `@macpaw/ai-sdk`          | `AIGatewayError`, `ErrorCode`                                                                                                           |
| Domain types              | `@macpaw/ai-sdk/types`    | Chat, embeddings, images, audio request/response types                                                                                  |

Auth: `getAuthToken: async () => string | null`. Use `env: 'production'` for production base URL, `baseURL: 'https://...'` for staging/custom.

Prefer `@macpaw/ai-sdk/provider` for AI SDK integration. It exposes the curated AI SDK surface we support, plus `createOpenAI`, so apps can keep provider selection in one place. Exception: React hooks (`useChat`, `useCompletion`) still come from `@ai-sdk/react`. Import transport/config/validation internals from `@macpaw/ai-sdk/runtime`, not `@macpaw/ai-sdk/client`.

## Developing the SDK

- Verify: `pnpm typecheck && pnpm lint && pnpm test`
- Commit style: Conventional Commits (`feat:`, `fix:`, etc.)
- Entry points: `src/index.ts`, `src/client-entry.ts`, `src/client/index.ts`, `src/client/api/*`, `src/runtime/index.ts`, `src/types/index.ts`, `src/core/index.ts`, `src/provider/index.ts`, `src/nestjs/index.ts`, `src/testing/index.ts`
- Tests live under `src/**/__tests__/` only.
- `@macpaw/ai-sdk/core` is internal/advanced runtime API (no domain type barrel) — prefer the main entry or `@macpaw/ai-sdk/types`
