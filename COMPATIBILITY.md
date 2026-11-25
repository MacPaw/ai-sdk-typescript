# SDK ↔ AI Gateway API — Compatibility Check

This document relates **AI Gateway HTTP routes** to how **`@macpaw/ai-sdk`** talks to the gateway today.

The SDK uses:

- an OpenAI-compatible **provider** (`createAIGatewayProvider` / `createGatewayProvider`) for Vercel `ai` generation APIs
- **`createGatewayFetch`** for arbitrary / multipart paths
- typed clients **`createVideoClient`**, **`createVoiceClient`**, **`createSpeechClient`**, **`createTranscriptionClient`**, **`createWebSearchClient`**, and **`createDecisionClient`** for the video, voices, speech, transcription, web search, and decisions Gateway routes

## Paths

Gateway routes are versioned under `/ai/v1/...` or `/ai/v2/...` (from the host root). With `createGatewayFetch` the base already includes `/ai`, so pass the path relative to it (`/v1/...`). The Vercel/OpenAI stack issues requests under the same prefix automatically. Typed clients use the same relative paths on a resolved `baseURL`.

| API                  | Full route (from host)             | Relative path (base `…/ai`)     | SDK surface                        |
| -------------------- | ---------------------------------- | ------------------------------- | ---------------------------------- |
| Chat completions     | `/ai/v1/chat/completions`          | `/v1/chat/completions`          | provider                           |
| Responses            | `/ai/v1/responses`                 | `/v1/responses`                 | provider                           |
| Embeddings           | `/ai/v1/embeddings`                | `/v1/embeddings`                | provider                           |
| Model info           | `/ai/v1/model/info`                | `/v1/model/info`                | provider / `createGatewayFetch`    |
| Images generations   | `/ai/v1/images/generations`        | `/v1/images/generations`        | provider / `createGatewayFetch`    |
| Images edits         | `/ai/v1/images/edits`              | `/v1/images/edits`              | `createGatewayFetch` (multipart)   |
| Audio transcriptions | `/ai/v1/audio/transcriptions`      | `/v1/audio/transcriptions`      | **Deprecated** — use v2 below      |
| Videos create        | `/ai/v1/videos`                    | `/v1/videos`                    | `createVideoClient.create`         |
| Videos get           | `/ai/v1/videos/{video_id}`         | `/v1/videos/{video_id}`         | `createVideoClient.get`            |
| Videos content       | `/ai/v1/videos/{video_id}/content` | `/v1/videos/{video_id}/content` | `createVideoClient.getContent`     |
| Voices list          | `/ai/v1/voices`                    | `/v1/voices`                    | `createVoiceClient.list`           |
| Audio speech create  | `/ai/v1/audio/speech`              | `/v1/audio/speech`              | `createSpeechClient.create`        |
| Audio transcriptions | `/ai/v2/audio/transcriptions`      | `/v2/audio/transcriptions`      | `createTranscriptionClient.create` |
| Web search           | `/ai/v1/websearch`                 | `/v1/websearch`                 | `createWebSearchClient.search`     |
| Decisions            | `/ai/v1/decisions`                 | `/v1/decisions`                 | `createDecisionClient.create`      |

`createVoiceClient.list()` sends `provider` (required) and optional `next_page_token` as query params.

`createSpeechClient.create()` requires `model`, `input`, and `voice`; the response is always streaming (SSE, or the provider's own raw stream when `raw_provider_response: true`), so `create()` returns the raw `Response` rather than parsed JSON.

`createTranscriptionClient.create()` sends `multipart/form-data` with `model` and exactly one of `file` / `source_url`; only the Gateway-level fields (`model`, audio source, `language`, `stream`) are typed, and provider-specific fields are forwarded as sent under their native names. It returns parsed JSON (provider response, unchanged), a string for `text/plain` responses, or the raw `Response` for any `text/event-stream` response (always the case for `stream: true`). It accepts a per-call `signal`, ignores a configured `Content-Type` header (the multipart boundary must come from `fetch`), and defaults its timeout to 10 minutes (`DEFAULT_TRANSCRIPTION_TIMEOUT_MS`).

`createWebSearchClient.search()` sends JSON with `model` and `query`; only the Gateway-level fields (`model`, `query`, `limit`, `include_domains`, `exclude_domains`, `country`, `location`) are typed, and `provider_options` plus any other field are forwarded as sent under their native names. It returns the provider's parsed JSON response, unchanged. It accepts a per-call `signal`, never retries on 429 / 5xx, and defaults its timeout to 2 minutes (`DEFAULT_WEBSEARCH_TIMEOUT_MS`).

`createDecisionClient.create()` sends JSON with `model`, `state` and `questions` (at least one); `assets`, `session_id` and `user` are typed too, and any other field is forwarded as sent. It returns the parsed `DecisionResponse` (`answers` keyed by question name, `usage`). It accepts a per-call `signal` and never retries on 429 / 5xx.

`/v1/audio/transcriptions` (provider `transcription()` model / `createGatewayFetch`) is **deprecated** in favour of `/v2/audio/transcriptions` via `createTranscriptionClient`.

## Base URL

- **SDK** `DEFAULT_BASE_URLS.production`: `https://api.macpaw.com/ai`
- Other environments: pass `baseURL` explicitly on `GatewayProviderSettings` / `createGatewayFetch` / the typed clients.

## Authorization

Gateway expects `Authorization: Bearer <token>`. The SDK sets it from `getAuthToken()` on gateway-scoped requests. After **401**, it calls `getAuthToken(true)` once and retries.

## Error formats

`parseErrorResponse` / `parseErrorResponseFromResponse` in `gateway-errors.ts` support:

1. Gateway JSON: `statusCode`, `message`, `timestamp`, `code`, `path`, optional `errors[]`
2. OpenAI proxy shape: `{ error: { message, type, code } }`

Codes map to `ErrorCode` and typed errors (`AuthError`, `CreditsError`, …). `PAYMENT_REQUIRED` (used on **402** by the audio speech, transcription, web search, and decisions endpoints) and `INSUFFICIENT_CREDITS` both normalize to `CreditsError` / `ErrorCode.InsufficientCredits`. `REQUEST_TIMEOUT` (**408**) normalizes to `ErrorCode.Timeout`; `PAYLOAD_TOO_LARGE` (**413**) to `ErrorCode.BadRequest`.

## Multipart and streaming

- **Multipart** (`multipart/form-data`): `createTranscriptionClient` builds the form itself; for other multipart routes build `FormData` in app code and `POST` via `createGatewayFetch`.
- **SSE**: consumed by upstream **`ai`** / provider streaming, not by a separate SSE helper in this package’s public API — `createSpeechClient.create()` follows the same rule and returns the raw `Response` for callers to read `.body` as a stream, the same way `createVideoClient.getContent()` returns raw binary content.

## Provider vs custom fetch vs typed clients

| Style                                                      | Mechanism                                           |
| ---------------------------------------------------------- | --------------------------------------------------- |
| `generateText`, `streamText`, tools, embeddings via Vercel | `createAIGatewayProvider` / `createGatewayProvider` |
| Custom HTTP (multipart, bespoke routes)                    | `createGatewayFetch` + `fetch` API                  |
| Video generation (create / poll / content)                 | `createVideoClient`                                 |
| Voice listing (paginated)                                  | `createVoiceClient`                                 |
| Speech generation (streaming text-to-speech)               | `createSpeechClient`                                |
| Audio transcription (speech-to-text, multipart)            | `createTranscriptionClient`                         |
| Web search (Exa, Brave)                                    | `createWebSearchClient`                             |
| Decisions (typed questions → typed answers)                | `createDecisionClient`                              |
| Same gateway, same auth/retry/middleware                   | All use `GatewayProviderSettings` semantics         |

---

**Conclusion:** Wire format, base URL, auth, and error shapes stay aligned with AI Gateway. The SDK surface is provider + fetch bridge + typed video/voices/speech/transcription/web search/decisions clients + NestJS helpers.
