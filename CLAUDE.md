# AI Gateway SDK — Claude Code Instructions

This is `@macpaw/ai` — a universal TypeScript client for AI Gateway.

## Integrating an app with AI Gateway

Install `@macpaw/ai`. No other AI packages required.

| Stack | Import from | Key export |
|-------|-------------|------------|
| NestJS | `@macpaw/ai/nestjs` | `AIGatewayModule.forRootAsync()`, `@InjectAIGateway()`, `AIGatewayExceptionFilter` |
| Next.js / Vercel AI SDK | `@macpaw/ai/provider` | `createAIGatewayProvider`, `generateText`, `streamText` |
| Node / Express / Browser | `@macpaw/ai` | `createAIGatewayClient` |
| Tests | `@macpaw/ai/testing` | `createMockAIGatewayClient`, `createMockChatCompletion` |
| Errors | `@macpaw/ai` | `AIGatewayError`, `ErrorCode` |

Auth: `getAuthToken: async () => string | null`. Use `env: 'production'` for production base URL, `baseURL: 'https://...'` for staging/custom.

Do NOT import from `@ai-sdk/openai` or `ai` directly — the provider re-exports everything needed.

## Developing the SDK

- Verify: `pnpm typecheck && pnpm lint && pnpm test`
- Commit style: Conventional Commits (`feat:`, `fix:`, etc.)
- Entry points: `src/index.ts`, `src/core/index.ts`, `src/provider/index.ts`, `src/nestjs/index.ts`, `src/testing/index.ts`
- `@macpaw/ai/core` is internal/advanced API — prefer the main entry point
