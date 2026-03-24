# @macpaw/ai-sdk

> Changelog is maintained by [semantic-release](https://github.com/semantic-release/semantic-release). Versions and entries are added automatically on release; do not edit version headings manually.

## Unreleased

### Added

- README and COMPATIBILITY: when to use `@macpaw/ai-sdk/provider` vs `createAIGatewayClient`, optional dual-backend (env flag) example, and auth placement notes.
- CONTRIBUTING: package layout, `__tests__` convention, and linting/formatting notes.
- `@macpaw/ai-sdk/types` subpath for domain types; `GatewayApiCode`, `GatewayApiErrorResponse`, and related symbols.
- `customProvider` re-export and `createAIGatewayCustomProvider` helper on `@macpaw/ai-sdk/provider`.
- Repository-owned ESLint / TypeScript config updates and Stylelint wiring.
- `lint:style` (Stylelint; ignores all files until CSS is added).

### Changed

- HTTP facades moved from `src/api/` to `src/client/api/` (internal structure only; public imports unchanged).
- Tests live under colocated `src/**/__tests__/` directories.
- Client entry moved to `src/client/index.ts`; `@macpaw/ai-sdk/core` no longer re-exports domain types (use the main entry or `@macpaw/ai-sdk/types`).

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
