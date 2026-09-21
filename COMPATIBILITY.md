# SDK ↔ AI Gateway API — Compatibility Check

This document relates **AI Gateway HTTP routes** to how **`@macpaw/ai-sdk`** talks to the gateway today.

The SDK uses:

- an OpenAI-compatible **provider** (`createAIGatewayProvider` / `createGatewayProvider`) for Vercel `ai` generation APIs
- **`createGatewayFetch`** for arbitrary / multipart paths
- typed clients **`createVideoClient`** and **`createVoiceClient`** for the video and voices Gateway routes

## Paths

Gateway routes are versioned under `/ai/v1/...` (from the host root). With `createGatewayFetch` the base already includes `/ai`, so pass the path relative to it (`/v1/...`). The Vercel/OpenAI stack issues requests under the same prefix automatically. Typed clients use the same relative paths on a resolved `baseURL`.

| API                  | Full route (from host)             | Relative path (base `…/ai`)     | SDK surface                      |
| -------------------- | ---------------------------------- | ------------------------------- | -------------------------------- |
| Chat completions     | `/ai/v1/chat/completions`          | `/v1/chat/completions`          | provider                         |
| Responses            | `/ai/v1/responses`                 | `/v1/responses`                 | provider                         |
| Embeddings           | `/ai/v1/embeddings`                | `/v1/embeddings`                | provider                         |
| Model info           | `/ai/v1/model/info`                | `/v1/model/info`                | provider / `createGatewayFetch`  |
| Images generations   | `/ai/v1/images/generations`        | `/v1/images/generations`        | provider / `createGatewayFetch`  |
| Images edits         | `/ai/v1/images/edits`              | `/v1/images/edits`              | `createGatewayFetch` (multipart) |
| Audio transcriptions | `/ai/v1/audio/transcriptions`      | `/v1/audio/transcriptions`      | provider / `createGatewayFetch`  |
| Videos create        | `/ai/v1/videos`                    | `/v1/videos`                    | `createVideoClient.create`       |
| Videos get           | `/ai/v1/videos/{video_id}`         | `/v1/videos/{video_id}`         | `createVideoClient.get`          |
| Videos content       | `/ai/v1/videos/{video_id}/content` | `/v1/videos/{video_id}/content` | `createVideoClient.getContent`   |
| Voices list          | `/ai/v1/voices`                    | `/v1/voices`                    | `createVoiceClient.list`         |

`createVoiceClient.list()` sends `provider` (required) and optional `next_page_token` as query params.

## Base URL

- **SDK** `DEFAULT_BASE_URLS.production`: `https://api.macpaw.com/ai`
- Other environments: pass `baseURL` explicitly on `GatewayProviderSettings` / `createGatewayFetch` / the typed clients.

## Authorization

Gateway expects `Authorization: Bearer <token>`. The SDK sets it from `getAuthToken()` on gateway-scoped requests. After **401**, it calls `getAuthToken(true)` once and retries.

## Error formats

`parseErrorResponse` / `parseErrorResponseFromResponse` in `gateway-errors.ts` support:

1. Gateway JSON: `statusCode`, `message`, `timestamp`, `code`, `path`, optional `errors[]`
2. OpenAI proxy shape: `{ error: { message, type, code } }`

Codes map to `ErrorCode` and typed errors (`AuthError`, `CreditsError`, …).

## Multipart and streaming

- **Multipart** (`multipart/form-data`): build `FormData` in app code and `POST` via `createGatewayFetch`.
- **SSE**: consumed by upstream **`ai`** / provider streaming, not by a separate SSE helper in this package’s public API.

## Provider vs custom fetch vs typed clients

| Style                                                      | Mechanism                                           |
| ---------------------------------------------------------- | --------------------------------------------------- |
| `generateText`, `streamText`, tools, embeddings via Vercel | `createAIGatewayProvider` / `createGatewayProvider` |
| Custom HTTP (multipart, bespoke routes)                    | `createGatewayFetch` + `fetch` API                  |
| Video generation (create / poll / content)                 | `createVideoClient`                                 |
| Voice listing (paginated)                                  | `createVoiceClient`                                 |
| Same gateway, same auth/retry/middleware                   | All use `GatewayProviderSettings` semantics         |

---

**Conclusion:** Wire format, base URL, auth, and error shapes stay aligned with AI Gateway. The SDK surface is provider + fetch bridge + typed video/voices clients + NestJS helpers.
