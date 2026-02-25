# @macpaw/ai

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
- Error normalization layer (BFF + OpenAI formats)
- Retry with exponential backoff
- Middleware / interceptor chain
- Pluggable transport layer
- Per-request AbortSignal and timeout support
- Lifecycle hooks (onRequest, onResponse, onError, onRetry)
- X-Request-ID generation and tracking
- Vercel AI SDK provider integration
- Dual ESM + CJS output
- Tree-shakeable, zero runtime dependencies
