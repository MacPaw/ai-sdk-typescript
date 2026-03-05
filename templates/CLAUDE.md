# AI Gateway (@macpaw/ai-sdk)

Universal TypeScript client for AI Gateway. Install `@macpaw/ai-sdk` — no other AI packages required.

| Stack | Import from | Key export |
|-------|-------------|------------|
| NestJS | `@macpaw/ai-sdk/nestjs` | `AIGatewayModule.forRootAsync()`, `@InjectAIGateway()`, `AIGatewayExceptionFilter` |
| Next.js / Vercel AI SDK | `@macpaw/ai-sdk/provider` | `createAIGatewayProvider`, `generateText`, `streamText` |
| Node / Express / Browser | `@macpaw/ai-sdk` | `createAIGatewayClient` |
| Tests | `@macpaw/ai-sdk/testing` | `createMockAIGatewayClient`, `createMockChatCompletion` |
| Errors | `@macpaw/ai-sdk` | `AIGatewayError`, `ErrorCode` |

Auth: `getAuthToken: async () => string | null`. Use `env: 'production'` for production base URL, `baseURL: 'https://...'` for staging/custom.

Do NOT import model providers from `@ai-sdk/openai` directly — use `@macpaw/ai-sdk/provider` for provider setup and generation helpers.
React hooks such as `useChat` come from the Vercel AI SDK React package (`@ai-sdk/react` or `ai/react`), not from `@macpaw/ai-sdk/provider`.

Common mistakes: `env` only supports `'production'` (use `baseURL` for staging). Retry uses `maxAttempts`, not `maxRetries`. Never hardcode tokens — use `getAuthToken`.
