# SDK ↔ AI Gateway API — Compatibility Check

This document confirms that `@macpaw/ai-sdk` is aligned with the AI Gateway HTTP API. Examples below use NestJS-flavoured controller references because that is a common gateway implementation, but the SDK contract is framework-agnostic.

## Paths

| API                  | SDK path                       | Example gateway route                              | Status |
| -------------------- | ------------------------------ | -------------------------------------------------- | ------ |
| Chat completions     | `/api/v1/chat/completions`     | `@Controller('chat')` + `@Post('completions')`     | ✓      |
| Responses            | `/api/v1/responses`            | `@Controller('responses')` + `@Post()`             | ✓      |
| Embeddings           | `/api/v1/embeddings`           | `@Controller('embeddings')` + `@Post()`            | ✓      |
| Model info           | `/api/v1/model/info`           | `@Controller()` + `@Get('model/info')`             | ✓      |
| Images generations   | `/api/v1/images/generations`   | `@Controller('images')` + `@Post('generations')`   | ✓      |
| Images edits         | `/api/v1/images/edits`         | `@Controller('images')` + `@Post('edits')`         | ✓      |
| Audio transcriptions | `/api/v1/audio/transcriptions` | `@Controller('audio')` + `@Post('transcriptions')` | ✓      |
| Audio translations   | `/api/v1/audio/translations`   | `@Controller('audio')` + `@Post('translations')`   | ✓      |

The gateway uses `setGlobalPrefix('api')` and URI versioning with default version `'1'`, so full paths are `/api/v1/...`. The SDK uses the same paths.

## Base URL

- **SDK** `DEFAULT_BASE_URLS`: `production: https://api.macpaw.com/ai`. Non-production URLs are not built-in; pass via `baseURL`.
- **Docs** (e.g. `create-chat-completion.yaml`, `ai-gateway-errors.yaml`): `https://api.{domain}/ai` with `macpaw.com`

So the SDK base URL and docs match.

## Authorization

- **Gateway**: Expects `Authorization: Bearer <token>` (BearerAuth in Swagger, guards).
- **SDK**: Sends `Authorization: Bearer ${token}` from `getAuthToken()`.

No mismatch.

## Error formats

- **Gateway** (from `ai-gateway-errors.yaml`): Returns `statusCode`, `message`, `timestamp`, `code`, `path`, optional `errors[]`; `errors[].metadata` can contain `paymentUrl`, `retryAfter`.
- **SDK** `parseErrorResponse`: Handles this shape and maps `code` to normalized codes; reads `paymentUrl` and `retryAfter` from `errors[0].metadata`.
- **Gateway API codes** (UNAUTHORIZED, INSUFFICIENT_CREDITS, FORBIDDEN, RATE_LIMIT_EXCEEDED, BAD_REQUEST, VALIDATION, …) are mapped to SDK codes (AUTH_REQUIRED, INSUFFICIENT_CREDITS, MODEL_NOT_ALLOWED, RATE_LIMITED, …). OpenAI proxy format (`error.message`, `error.type`) is also handled.

So error handling is compatible.

## Request/response bodies

- **Chat / Responses / Embeddings / Images (generations)**: JSON; SDK sends JSON and parses JSON. The gateway uses OpenAI-compatible DTOs.
- **Images (edits) / Audio**: `multipart/form-data`. SDK uses `FormData` with fields `image`, `prompt`, `mask`, `model`, etc. (image edit) and `file`, `model`, etc. (audio). The gateway uses `FileFieldsInterceptor` / `FileInterceptor` with the same field names (`image`, `mask`, `file`).

No known mismatch.

## Streaming

- **Chat / Responses**: Gateway returns SSE when `stream: true`; SDK uses `parseSSEAsJSON` and expects `text/event-stream` (or `application/json` for non-streaming).
- **Audio transcriptions**: Gateway supports streaming; SDK sends `stream: true` in form data and consumes SSE.

Aligned.

## Model info endpoint

- **SDK**: GET `/api/v1/model/info` with optional query `litellm_model_id`.
- **Gateway**: `ModelsController` `@Get('model/info')` with `@Query('litellm_model_id')`.

Same contract; `@Public()` on the controller means auth is optional, but SDK still sends the token when available.

## Vercel AI SDK provider vs advanced HTTP client

Both talk to the same gateway; they differ by **integration style**, not by wire format. For new app integrations, prefer `@macpaw/ai-sdk/provider`. Reach for `@macpaw/ai-sdk/client` when you need multipart or direct request-pipeline control.

| Capability                                           | `createAIGatewayProvider` (`@macpaw/ai-sdk/provider`)                        | `createAIGatewayClient` (`@macpaw/ai-sdk/client`) |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| Chat / completions (JSON, SSE)                       | Yes — via `@ai-sdk/openai`-compatible surface                                | Yes                                               |
| Responses API (stream)                               | Yes, when exposed like OpenAI                                                | Yes                                               |
| Embeddings                                           | Yes, when used through Vercel AI SDK `embed` / provider                      | Yes                                               |
| Tools / `generateText` / `streamText`                | Yes — primary use case                                                       | Use client only if you do not use Vercel AI SDK   |
| Image generations (JSON)                             | Often yes (OpenAI-shaped)                                                    | Yes                                               |
| Image **edits** (`multipart/form-data`)              | Not the main path — use client                                               | Yes                                               |
| Audio transcription / translation (`multipart`, SSE) | Not the main path — use client                                               | Yes                                               |
| Auth refresh-aware fetch wrapper                     | Yes — `createAIGatewayFetch` can refresh on 401 and normalize gateway errors | Yes                                               |
| SDK middleware / lifecycle hooks on every call       | Fetch-level interception only (`createAIGatewayFetch`)                       | Yes — full pipeline                               |

Auth for the provider is injected through `getAuthToken` inside `createAIGatewayProvider` / `createAIGatewayFetch`, using the same Bearer contract as the HTTP client. The provider path now also supports token refresh-aware auth and normalized gateway errors, while the HTTP client remains the richer option for multipart endpoints and request-pipeline middleware.

---

**Conclusion**: The SDK is compatible with the current AI Gateway HTTP API. Paths, base URLs, auth, error handling, body formats, and streaming behavior match the implementation and docs.
