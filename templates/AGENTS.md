# AI Gateway (@macpaw/ai-sdk)

Vercel AI SDK extension layer for AI Gateway, plus an advanced low-level HTTP client.

## Integrating with AI Gateway

1. **Install:** `pnpm add @macpaw/ai-sdk` — no other AI packages needed unless you use React hooks from `@ai-sdk/react`.
2. **Detect stack and choose path:**
   - **NestJS** (or **Node.js (NestJS)**) → `AIGatewayModule` from `@macpaw/ai-sdk/nestjs`, inject with `@InjectAIGateway()`, use `AIGatewayExceptionFilter`.
   - **Next.js / Vercel AI SDK** → `@macpaw/ai-sdk/provider` as the primary path: `createAIGatewayProvider`, `createAIGatewayCustomProvider`, `createAIGatewayDualProvider`, `createOpenAI`, `generateText`, `streamText`.
   - **Node / Express / Browser with direct Gateway HTTP usage** → `createAIGatewayClient` from `@macpaw/ai-sdk/client`.
3. **Auth:** always `getAuthToken: async () => token` (Bearer). Use `env: 'production'` for prod URL, `baseURL` for staging.
4. **Errors:** catch `AIGatewayError` from `@macpaw/ai-sdk`. Key fields: `code` (ErrorCode enum), `paymentUrl`, `retryAfter`, `requestId`.
5. **Testing:** use `createMockOpenAIProvider` for provider-first apps, and `createMockAIGatewayClient` when you intentionally test the low-level client path.

## Common mistakes

- Use `@macpaw/ai-sdk/provider` for gateway-backed setup and generation helpers. It already exposes the curated AI SDK surface plus `createOpenAI` for dual-backend flows.
- Keep React hooks (`useChat`) from the Vercel AI SDK React package such as `@ai-sdk/react`, not from `@macpaw/ai-sdk/provider`.
- `env` only supports `'production'`. For staging use `baseURL`.
- Retry config uses `maxAttempts`, not `maxRetries`.
- Never hardcode tokens — use `getAuthToken`.
- Import `createAIGatewayClient` from `@macpaw/ai-sdk/client`, not the root package.
