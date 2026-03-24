# AI Gateway (@macpaw/ai-sdk)

Vercel AI SDK extension layer for AI Gateway, plus an advanced low-level HTTP client.

## Integrating with AI Gateway

1. **Install:** `pnpm add @macpaw/ai-sdk` — add `react` + `@ai-sdk/react` for UI hooks; add the matching `@ai-sdk/*` peer only for provider subpaths you import (e.g. `@ai-sdk/xai` for `@macpaw/ai-sdk/xai`).
2. **Detect stack and choose path:**
   - **NestJS** (or **Node.js (NestJS)**) → `AIGatewayModule` from `@macpaw/ai-sdk/nestjs`, inject with `@InjectAIGateway()`, use `AIGatewayExceptionFilter`.
   - **Next.js / Vercel AI SDK** → `@macpaw/ai-sdk/ai` or `@macpaw/ai-sdk/provider` (same module): `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createOpenAI`, `generateText`, `streamText`. Subpaths `@macpaw/ai-sdk/ai/internal`, `@macpaw/ai-sdk/ai/test` replace `ai/internal`, `ai/test`. Optional mirrors: `@macpaw/ai-sdk/react`, `@macpaw/ai-sdk/anthropic`, `@macpaw/ai-sdk/google`, `@macpaw/ai-sdk/xai`, `@macpaw/ai-sdk/groq`, `@macpaw/ai-sdk/mistral`, `@macpaw/ai-sdk/amazon-bedrock`, `@macpaw/ai-sdk/azure`, `@macpaw/ai-sdk/cohere`, `@macpaw/ai-sdk/perplexity`, `@macpaw/ai-sdk/deepseek`, `@macpaw/ai-sdk/togetherai`, `@macpaw/ai-sdk/openai-compatible` — each re-exports `@ai-sdk/<name>`; install the peer you use.
   - **Node / Express / Browser with direct Gateway HTTP usage** → `createAIGatewayClient` from `@macpaw/ai-sdk/client`.
3. **Auth:** always `getAuthToken: async () => token` (Bearer). Use `env: 'production'` for prod URL, `baseURL` for staging.
4. **Errors:** catch `AIGatewayError` from `@macpaw/ai-sdk`. Key fields: `code` (ErrorCode enum), `paymentUrl`, `retryAfter`, `requestId`.
5. **Testing:** use `createMockOpenAIProvider` for provider-first apps, and `createMockAIGatewayClient` when you intentionally test the low-level client path.

## Common mistakes

- Use `@macpaw/ai-sdk/ai` or `@macpaw/ai-sdk/provider` for gateway-backed setup: it re-exports the full `ai` package plus `createOpenAI` and AI Gateway helpers. Prefer a single import path instead of mixing `ai` and this entry.
- React hooks (`useChat`): `@macpaw/ai-sdk/react` or `@ai-sdk/react`, not from `@macpaw/ai-sdk/ai` / `@macpaw/ai-sdk/provider`.
- If the app imports `ai` or `@ai-sdk/openai` directly for non-gateway helpers, keep those package versions aligned with `@macpaw/ai-sdk`.
- `env` only supports `'production'`. For staging use `baseURL`.
- Retry config uses `maxAttempts`, not `maxRetries`.
- Never hardcode tokens — use `getAuthToken`.
- Import `createAIGatewayClient` from `@macpaw/ai-sdk/client`, not the root package.
