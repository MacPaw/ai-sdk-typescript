# @macpaw/ai-sdk

> Changelog is maintained by [semantic-release](https://github.com/semantic-release/semantic-release). Versions and entries are added automatically on release; do not edit version headings manually.

## Unreleased

### Changed

- Flat `src/` architecture — no `src/api/` or `src/client/` subdirectories.
- `createGatewayFetch` replaces the old low-level client as the escape-hatch for custom HTTP calls.
- `@ai-sdk/openai` is now a required peer dependency (used directly in `gateway-provider.ts`).
- `withRetry` now accepts `Required<RetryConfig>` (already-normalised config); callers must not pass un-normalised objects.
- Auth retry guard: requests with a streaming body (`ReadableStream`) throw `AuthError` immediately instead of attempting a silent re-play of the consumed stream.
- Test coverage added for `gateway-errors`, `gateway-retry`, `gateway-request` internals, and NestJS decorators.
- Removed `@macpaw/ai-sdk/types` subpath — domain types are exported from the root entry.
- Removed `@macpaw/ai-sdk/runtime` subpath — there is no separate runtime surface.
- Removed lifecycle hooks (`onRequest`, `onResponse`, `onError`, `onRetry`) — not part of the public API.
- Removed pluggable transport layer — `GatewayProviderSettings.fetch` covers custom fetch injection.
- Removed `autoRefreshToken` / `tokenCacheTTL` options — token refresh is handled automatically on 401.
- Vitest fails when no tests are discovered, tightening release-time verification.

## 0.1.0

### Added

- `createAIGatewayProvider` / `createGatewayProvider` — Vercel AI SDK provider for the MacPaw AI Gateway.
- `GATEWAY_PROVIDERS` — map of supported model providers.
- `createGatewayFetch` / `GATEWAY_PLACEHOLDER_API_KEY` — escape-hatch for custom HTTP calls to the gateway.
- Error class hierarchy: `AIGatewayError`, `AuthError`, `CreditsError`, `RateLimitError`, `ModelNotAllowedError`, `GatewayValidationError`.
- `parseErrorResponse` / `parseStreamErrorPayload` / `parseErrorResponseFromResponse` — normalise both Gateway API and OpenAI proxy error shapes.
- Auth via `getAuthToken` callback; automatic token refresh on 401 with a single retry.
- Retry with exponential backoff and jitter (`withRetry`, `RetryConfig`).
- Middleware pipeline (`Middleware` type, applied per-request).
- Per-request timeout via `AbortController`; combined `AbortSignal` support via `anySignal`.
- `X-Request-ID` auto-generation and propagation.
- NestJS integration: `AIGatewayModule`, `AI_GATEWAY_CONFIG` token, `@InjectAIGateway()` decorator, `AIGatewayExceptionFilter`.
- Exported types: `GatewayProviderSettings`, `RetryConfig`, `Middleware`, `ErrorCode`, `NormalizedErrorMetadata`, etc.
- Dual ESM + CJS output via tsup.
- Strict TypeScript targeting ES2022.
