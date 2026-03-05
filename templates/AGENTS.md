# AI Gateway (@macpaw/ai-sdk)

TypeScript client for AI Gateway (Chat, Embeddings, Images, Audio, Responses).

## Integrating with AI Gateway

1. **Install:** `pnpm add @macpaw/ai-sdk` — no other AI packages needed.
2. **Detect stack and choose path:**
   - **NestJS** → `AIGatewayModule` from `@macpaw/ai-sdk/nestjs`, inject with `@InjectAIGateway()`, use `AIGatewayExceptionFilter`.
   - **Next.js / Vercel AI SDK** → `createAIGatewayProvider` + `generateText`/`streamText` from `@macpaw/ai-sdk/provider`.
   - **Node / Express / Browser** → `createAIGatewayClient` from `@macpaw/ai-sdk`.
3. **Auth:** always `getAuthToken: async () => token` (Bearer). Use `env: 'production'` for prod URL, `baseURL` for staging.
4. **Errors:** catch `AIGatewayError` from `@macpaw/ai-sdk`. Key fields: `code` (ErrorCode enum), `paymentUrl`, `retryAfter`, `requestId`.
5. **Testing:** use `createMockAIGatewayClient` from `@macpaw/ai-sdk/testing`.

## Common mistakes

- Use `@macpaw/ai-sdk/provider` instead of direct `@ai-sdk/openai` imports for provider setup and generation helpers.
- Keep React hooks (`useChat`) from Vercel AI SDK React package (`@ai-sdk/react` or `ai/react`), not from `@macpaw/ai-sdk/provider`.
- `env` only supports `'production'`. For staging use `baseURL`.
- Retry config uses `maxAttempts`, not `maxRetries`.
- Never hardcode tokens — use `getAuthToken`.
