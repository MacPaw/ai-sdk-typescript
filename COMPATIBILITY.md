# SDK ↔ AI Gateway API — Compatibility Check

This document relates **AI Gateway HTTP routes** to how **`@macpaw/ai-sdk`** talks to the gateway today. The SDK does not ship a typed HTTP client; it uses an OpenAI-compatible **provider** plus **`createGatewayFetch`** for arbitrary paths.

## Paths

Gateway routes are versioned under `/api/v1/...`. Use `createGatewayFetch` with the correct path, or let the Vercel/OpenAI stack issue requests under the same prefix.

| API                  | Typical path                   |
| -------------------- | ------------------------------ |
| Chat completions     | `/api/v1/chat/completions`     |
| Responses            | `/api/v1/responses`            |
| Embeddings           | `/api/v1/embeddings`           |
| Model info           | `/api/v1/model/info`           |
| Images generations   | `/api/v1/images/generations`   |
| Images edits         | `/api/v1/images/edits`         |
| Audio transcriptions | `/api/v1/audio/transcriptions` |
| Audio translations   | `/api/v1/audio/translations`   |

## Base URL

- **SDK** `DEFAULT_BASE_URLS.production`: `https://api.macpaw.com/ai`
- Other environments: pass `baseURL` explicitly on `GatewayProviderSettings` / `createGatewayFetch`.

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

## Provider vs custom fetch

| Style                                                      | Mechanism                                           |
| ---------------------------------------------------------- | --------------------------------------------------- |
| `generateText`, `streamText`, tools, embeddings via Vercel | `createAIGatewayProvider` / `createGatewayProvider` |
| Custom HTTP (multipart, bespoke routes)                    | `createGatewayFetch` + `fetch` API                  |
| Same gateway, same auth/retry/middleware                   | Both use `GatewayProviderSettings` semantics        |

---

**Conclusion:** Wire format, base URL, auth, and error shapes stay aligned with AI Gateway. The SDK surface is intentionally thin: provider + fetch bridge + NestJS helpers.
