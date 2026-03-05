# AI Gateway (@macpaw/ai)

TypeScript client for AI Gateway (Chat, Embeddings, Images, Audio, Responses).

## Integrating with AI Gateway

1. **Install:** `pnpm add @macpaw/ai` — no other AI packages needed.
2. **Detect stack and choose path:**
   - **NestJS** → `AIGatewayModule` from `@macpaw/ai/nestjs`, inject with `@InjectAIGateway()`, use `AIGatewayExceptionFilter`.
   - **Next.js / Vercel AI SDK** → `createAIGatewayProvider` + `generateText`/`streamText` from `@macpaw/ai/provider`.
   - **Node / Express / Browser** → `createAIGatewayClient` from `@macpaw/ai`.
3. **Auth:** always `getAuthToken: async () => token` (Bearer). Use `env: 'production'` for prod URL, `baseURL` for staging.
4. **Errors:** catch `AIGatewayError` from `@macpaw/ai`. Key fields: `code` (ErrorCode enum), `paymentUrl`, `retryAfter`, `requestId`.
5. **Testing:** use `createMockAIGatewayClient` from `@macpaw/ai/testing`.

## Common mistakes

- Use `@macpaw/ai/provider` instead of direct `@ai-sdk/openai` or `ai` imports.
- `env` only supports `'production'`. For staging use `baseURL`.
- Retry config uses `maxAttempts`, not `maxRetries`.
- Never hardcode tokens — use `getAuthToken`.
