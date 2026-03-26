# AI Gateway (@macpaw/ai-sdk)

Vercel AI SDK extension layer for AI Gateway. Install `@macpaw/ai-sdk`; add upstream `ai` for `generateText` / `streamText`, `@ai-sdk/openai` when you need direct OpenAI-compatible providers, and `react` + `@ai-sdk/react` for hooks (or use `@macpaw/ai-sdk/react`). If your app also uses provider-specific upstream packages such as `@ai-sdk/anthropic` or `@ai-sdk/google`, install those directly in the app.

| Stack                      | Import from               | Key export                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NestJS / Node.js (NestJS)  | `@macpaw/ai-sdk/nestjs`   | `AIGatewayModule.forRootAsync()`, `@InjectAIGateway()`, `AIGatewayExceptionFilter`                                                                                                                                                                     |
| Next.js / Vercel AI SDK    | `@macpaw/ai-sdk/provider` | `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createGatewayProvider`, `GATEWAY_PROVIDERS`; keep `generateText`, `streamText`, `customProvider`, and other core primitives on upstream `ai` / `@ai-sdk/*` |
| Node / Express / Browser   | `@macpaw/ai-sdk/client`   | `createAIGatewayClient`                                                                                                                                                                                                                                |
| Advanced runtime internals | `@macpaw/ai-sdk/runtime`  | `API_PATHS`, `createFetchTransport`, `SDKValidationError`, retry/SSE/request helpers                                                                                                                                                                   |
| Tests                      | `@macpaw/ai-sdk/testing`  | `createMockOpenAIProvider`, `createMockAIGatewayClient`, `createMockChatCompletion`                                                                                                                                                                    |
| Errors                     | `@macpaw/ai-sdk`          | `AIGatewayError`, `ErrorCode`                                                                                                                                                                                                                          |
| Domain types               | `@macpaw/ai-sdk/types`    | Request/response shapes for chat, embeddings, images, audio                                                                                                                                                                                            |

Auth: `getAuthToken: async () => string | null`. Use `env: 'production'` for production base URL, `baseURL: 'https://...'` for staging/custom.

Prefer upstream `ai` and `@ai-sdk/*` imports for Vercel AI SDK primitives. Use `@macpaw/ai-sdk/provider` only for AI Gateway-specific provider helpers such as `createAIGatewayProvider()`, `createAIGatewayCustomProvider()`, `createAIGatewayDualProvider()`, and `createGatewayProvider()`.
React hooks such as `useChat` come from `@macpaw/ai-sdk/react` or `@ai-sdk/react`, not from the provider entry.
If the app imports `ai` or `@ai-sdk/openai` directly for non-gateway helpers, keep those package versions aligned with `@macpaw/ai-sdk`.
Provider fetches and the low-level client share the same request pipeline semantics for auth refresh, retries, middleware, hooks, timeout, and transport selection.

Common mistakes: `env` only supports `'production'` (use `baseURL` for staging). Retry uses `maxAttempts`, not `maxRetries`. Never hardcode tokens — use `getAuthToken`.
