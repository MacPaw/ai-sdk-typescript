# AI Gateway (@macpaw/ai)

Universal TypeScript client for AI Gateway. Install `@macpaw/ai` — no other AI packages required.

| Stack | Import from | Key export |
|-------|-------------|------------|
| NestJS | `@macpaw/ai/nestjs` | `AIGatewayModule.forRootAsync()`, `@InjectAIGateway()`, `AIGatewayExceptionFilter` |
| Next.js / Vercel AI SDK | `@macpaw/ai/provider` | `createAIGatewayProvider`, `generateText`, `streamText` |
| Node / Express / Browser | `@macpaw/ai` | `createAIGatewayClient` |
| Tests | `@macpaw/ai/testing` | `createMockAIGatewayClient`, `createMockChatCompletion` |
| Errors | `@macpaw/ai` | `AIGatewayError`, `ErrorCode` |

Auth: `getAuthToken: async () => string | null`. Use `env: 'production'` for production base URL, `baseURL: 'https://...'` for staging/custom.

Do NOT import from `@ai-sdk/openai` or `ai` directly — `@macpaw/ai/provider` re-exports everything needed.

Common mistakes: `env` only supports `'production'` (use `baseURL` for staging). Retry uses `maxAttempts`, not `maxRetries`. Never hardcode tokens — use `getAuthToken`.
