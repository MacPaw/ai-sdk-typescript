# AI Gateway SDK — Claude Code Instructions

This is `@macpaw/ai-sdk` — a Vercel AI SDK extension layer for AI Gateway with an explicit advanced HTTP client path.

## Integrating an app with AI Gateway

Install `@macpaw/ai-sdk`. Add `react` + `@ai-sdk/react` for UI hooks (or import hooks from `@macpaw/ai-sdk/react`). Add the matching `@ai-sdk/*` peer only for provider subpaths you use (anthropic, google, xai, groq, mistral, amazon-bedrock, azure, cohere, perplexity, deepseek, togetherai, openai-compatible).

| Stack                     | Import from               | Key export                                                                                                                              |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| NestJS / Node.js (NestJS) | `@macpaw/ai-sdk/nestjs`   | `AIGatewayModule.forRootAsync()`, `@InjectAIGateway()`, `AIGatewayExceptionFilter`                                                      |
| Next.js / Vercel AI SDK   | `@macpaw/ai-sdk/ai` or `@macpaw/ai-sdk/provider` (same) | `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createOpenAI`, `generateText`, `streamText`; subpaths `@macpaw/ai-sdk/ai/internal`, `@macpaw/ai-sdk/ai/test` match `ai/internal`, `ai/test`; optional `@macpaw/ai-sdk/react` and `@macpaw/ai-sdk/<provider>` (anthropic, google, xai, groq, mistral, amazon-bedrock, azure, cohere, perplexity, deepseek, togetherai, openai-compatible) re-export matching `@ai-sdk/*` |
| Node / Express / Browser  | `@macpaw/ai-sdk/client`   | `createAIGatewayClient`                                                                                                                 |
| Advanced runtime internals| `@macpaw/ai-sdk/runtime`  | `API_PATHS`, `createFetchTransport`, `SDKValidationError`, retry/SSE/request helpers                                                    |
| Tests                     | `@macpaw/ai-sdk/testing`  | `createMockOpenAIProvider`, `createMockAIGatewayClient`, `createMockChatCompletion`                                                     |
| Errors                    | `@macpaw/ai-sdk`          | `AIGatewayError`, `ErrorCode`                                                                                                           |
| Domain types              | `@macpaw/ai-sdk/types`    | Chat, embeddings, images, audio request/response types                                                                                  |

Auth: `getAuthToken: async () => string | null`. Use `env: 'production'` for production base URL, `baseURL: 'https://...'` for staging/custom.

Prefer `@macpaw/ai-sdk/ai` or `@macpaw/ai-sdk/provider` for AI SDK integration (identical). The entry re-exports the full `ai` package and adds AI Gateway helpers plus `createOpenAI`, so apps can swap `from 'ai'` to `@macpaw/ai-sdk/ai` and keep one import path, including `ai/internal` and `ai/test` equivalents. `createAIGatewayDualProvider()` and `createAIGatewayCustomProvider()` accept eager providers or lazy factories for env-specific builds. React hooks: `@macpaw/ai-sdk/react` or `@ai-sdk/react`. Import transport/config/validation internals from `@macpaw/ai-sdk/runtime`, not `@macpaw/ai-sdk/client`.

## Developing the SDK

- Verify: `pnpm typecheck && pnpm lint && pnpm test`
- Commit style: Conventional Commits (`feat:`, `fix:`, etc.)
- Entry points: `src/index.ts`, `src/client-entry.ts`, `src/client/index.ts`, `src/client/api/*`, `src/runtime/index.ts`, `src/types/index.ts`, `src/core/index.ts`, `src/provider/index.ts`, `src/react/index.ts`, `src/anthropic/index.ts`, `src/google/index.ts`, `src/xai/index.ts`, `src/groq/index.ts`, `src/mistral/index.ts`, `src/amazon-bedrock/index.ts`, `src/azure/index.ts`, `src/cohere/index.ts`, `src/perplexity/index.ts`, `src/deepseek/index.ts`, `src/togetherai/index.ts`, `src/openai-compatible/index.ts`, `src/nestjs/index.ts`, `src/testing/index.ts`
- Tests live under `src/**/__tests__/` only.
- `@macpaw/ai-sdk/core` is internal/advanced runtime API (no domain type barrel) — prefer the main entry or `@macpaw/ai-sdk/types`
