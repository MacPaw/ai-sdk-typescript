# @macpaw/ai-sdk

> Changelog is maintained by [semantic-release](https://github.com/semantic-release/semantic-release). Versions and entries are added automatically on release; do not edit version headings manually.

## Unreleased

### Added

- `@macpaw/ai-sdk/react` subpath re-exports `@ai-sdk/react` so apps can import hooks from the MacPaw package scope alongside `@macpaw/ai-sdk/ai` / `provider`.
- `@macpaw/ai-sdk/provider` now re-exports the entire `ai` package (`export * from 'ai'`) for drop-in migration; AI Gateway symbols remain additive.
- ESLint: `examples/**/*.{js,mjs,cjs}` use Node globals so `pnpm lint` passes on demo scripts.
- Runnable examples for mock transport, direct client, Vercel-style provider flow, and a copy-ready NestJS skeleton.
- README badges and release signals documentation; local `pnpm size:pack` script for publish-size inspection.
- README and COMPATIBILITY: when to use `@macpaw/ai-sdk/provider` vs `createAIGatewayClient`, optional dual-backend (env flag) example, and auth placement notes.
- CONTRIBUTING: package layout, `__tests__` convention, and linting/formatting notes.
- `@macpaw/ai-sdk/types` subpath for domain types; `GatewayApiCode`, `GatewayApiErrorResponse`, and related symbols.
- `customProvider` re-export and `createAIGatewayCustomProvider` helper on `@macpaw/ai-sdk/provider`.
- Shared request pipeline parity between the low-level client and provider fetch path, including retries, middleware, hooks, timeout, and transport support.

### Changed

- Shared auth token caching and request execution logic between the client runtime and provider fetch path; stronger integration coverage around retries, token refresh, middleware, multipart flows, and provider/client parity.
- HTTP facades moved from `src/api/` to `src/client/api/` (internal structure only; public imports unchanged).
- Tests live under colocated `src/**/__tests__/` directories.
- Client entry moved to `src/client/index.ts`; advanced runtime primitives now live under the explicit `@macpaw/ai-sdk/runtime` surface (use the main entry or `@macpaw/ai-sdk/types` for app-facing imports).
- README and AI-assistant templates describe `@macpaw/ai-sdk/provider` as a full re-export of `ai` plus AI Gateway helpers.
- `macpaw-ai-setup` now reads the Cursor skill from published templates, so the npm package no longer needs to ship repository-only `.cursor` assets.
- Vitest now fails when no tests are discovered, tightening release-time verification.

### Deprecated

- Re-exporting domain types from the root `@macpaw/ai-sdk` entry — prefer `@macpaw/ai-sdk/types` (root re-exports may be removed in a future major version).

## 0.1.0

### Major Changes

- Initial release: AI Gateway SDK for browser and Node.js.

### Added

- Chat Completions API with streaming support
- Responses API (OpenAI format) with streaming support
- Embeddings API
- Images API (generation and editing)
- Audio API (transcription and translation with streaming)
- Model discovery API
- Error normalization layer (Gateway API + OpenAI formats)
- Retry with exponential backoff
- Middleware / interceptor chain
- Pluggable transport layer
- Per-request AbortSignal and timeout support
- Lifecycle hooks (onRequest, onResponse, onError, onRetry)
- X-Request-ID generation and tracking
- Vercel AI SDK provider integration
- Dual ESM + CJS output
- Tree-shakeable, zero runtime dependencies
