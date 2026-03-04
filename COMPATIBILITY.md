# SDK ↔ AI Gateway BFF — Compatibility Check

This document confirms that `@macpaw/ai` is aligned with the AI Gateway BFF (this repo).

## ✅ Paths

| API              | SDK path                          | BFF (NestJS)                    | Status |
|------------------|-----------------------------------|----------------------------------|--------|
| Chat completions | `/api/v1/chat/completions`        | `@Controller('chat')` + `@Post('completions')` | ✓ |
| Responses        | `/api/v1/responses`               | `@Controller('responses')` + `@Post()`        | ✓ |
| Embeddings       | `/api/v1/embeddings`              | `@Controller('embeddings')` + `@Post()`       | ✓ |
| Model info       | `/api/v1/model/info`              | `@Controller()` + `@Get('model/info')`        | ✓ |
| Images generations | `/api/v1/images/generations`    | `@Controller('images')` + `@Post('generations')` | ✓ |
| Images edits     | `/api/v1/images/edits`            | `@Controller('images')` + `@Post('edits')`    | ✓ |
| Audio transcriptions | `/api/v1/audio/transcriptions` | `@Controller('audio')` + `@Post('transcriptions')` | ✓ |
| Audio translations   | `/api/v1/audio/translations`   | `@Controller('audio')` + `@Post('translations')`   | ✓ |

BFF uses `setGlobalPrefix('api')` and URI versioning with default version `'1'`, so full paths are ` /api/v1/...`. SDK uses the same paths.

## ✅ Base URL

- **SDK** `DEFAULT_BASE_URLS`: `production: https://api.macpaw.com/ai`. Non-production URLs are not built-in; pass via `baseURL`.
- **Docs** (e.g. `create-chat-completion.yaml`, `ai-gateway-errors.yaml`): `https://api.{domain}/ai` with `macpaw.com`

So the SDK base URL and docs match.

## ✅ Authorization

- **BFF**: Expects `Authorization: Bearer <token>` (BearerAuth in Swagger, guards).
- **SDK**: Sends `Authorization: Bearer ${token}` from `getAuthToken()`.

No mismatch.

## ✅ Error formats

- **BFF** (from `ai-gateway-errors.yaml`): Returns `statusCode`, `message`, `timestamp`, `code`, `path`, optional `errors[]`; `errors[].metadata` can contain `paymentUrl`, `retryAfter`.
- **SDK** `parseErrorResponse`: Handles this BFF shape and maps `code` to normalized codes; reads `paymentUrl` and `retryAfter` from `errors[0].metadata`.
- **BFF codes** (UNAUTHORIZED, INSUFFICIENT_CREDITS, FORBIDDEN, RATE_LIMIT_EXCEEDED, BAD_REQUEST, VALIDATION, …) are mapped to SDK codes (AUTH_REQUIRED, INSUFFICIENT_CREDITS, MODEL_NOT_ALLOWED, RATE_LIMITED, …). OpenAI proxy format (`error.message`, `error.type`) is also handled.

So error handling is compatible.

## ✅ Request/response bodies

- **Chat / Responses / Embeddings / Images (generations)**: JSON; SDK sends JSON and parses JSON. BFF uses OpenAI-compatible DTOs.
- **Images (edits) / Audio**: `multipart/form-data`. SDK uses `FormData` with fields `image`, `prompt`, `mask`, `model`, etc. (image edit) and `file`, `model`, etc. (audio). BFF uses `FileFieldsInterceptor` / `FileInterceptor` with the same field names (`image`, `mask`, `file`).

No known mismatch.

## ✅ Streaming

- **Chat / Responses**: BFF returns SSE when `stream: true`; SDK uses `parseSSEAsJSON` and expects `text/event-stream` (or `application/json` for non-streaming).
- **Audio transcriptions**: BFF supports streaming; SDK sends `stream: true` in form data and consumes SSE.

Aligned.

## ✅ Model info endpoint

- **SDK**: GET `/api/v1/model/info` with optional query `litellm_model_id`.
- **BFF**: `ModelsController` `@Get('model/info')` with `@Query('litellm_model_id')`.

Same contract; `@Public()` on the controller means auth is optional, but SDK still sends the token when available.

---

**Conclusion**: The SDK is compatible with the current AI Gateway BFF. Paths, base URLs, auth, error handling, body formats, and streaming behavior match the implementation and docs.
