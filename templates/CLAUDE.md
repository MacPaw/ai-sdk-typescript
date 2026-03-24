# AI Gateway (@macpaw/ai-sdk)

Vercel AI SDK extension layer for AI Gateway. Install `@macpaw/ai-sdk` — no other AI packages are required unless your app uses React hooks from `@ai-sdk/react`.

| Stack                     | Import from               | Key export                                                                                                                              |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| NestJS / Node.js (NestJS) | `@macpaw/ai-sdk/nestjs`   | `AIGatewayModule.forRootAsync()`, `@InjectAIGateway()`, `AIGatewayExceptionFilter`                                                      |
| Next.js / Vercel AI SDK   | `@macpaw/ai-sdk/provider` | `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createOpenAI`, `generateText`, `streamText` |
| Node / Express / Browser  | `@macpaw/ai-sdk/client`   | `createAIGatewayClient`                                                                                                                 |
| Tests                     | `@macpaw/ai-sdk/testing`  | `createMockOpenAIProvider`, `createMockAIGatewayClient`, `createMockChatCompletion`                                                     |
| Errors                    | `@macpaw/ai-sdk`          | `AIGatewayError`, `ErrorCode`                                                                                                           |
| Domain types              | `@macpaw/ai-sdk/types`    | Request/response shapes for chat, embeddings, images, audio                                                                             |

Auth: `getAuthToken: async () => string | null`. Use `env: 'production'` for production base URL, `baseURL: 'https://...'` for staging/custom.

Prefer `@macpaw/ai-sdk/provider` for AI SDK integration. It exposes the curated AI SDK surface plus `createOpenAI` for dual-backend flows; it is not a full mirror of every `ai` export.
React hooks such as `useChat` come from the Vercel AI SDK React package (`@ai-sdk/react`), not from `@macpaw/ai-sdk/provider`.
If the app imports `ai` or `@ai-sdk/openai` directly for non-gateway helpers, keep those package versions aligned with `@macpaw/ai-sdk`.

Common mistakes: `env` only supports `'production'` (use `baseURL` for staging). Retry uses `maxAttempts`, not `maxRetries`. Never hardcode tokens — use `getAuthToken`.
