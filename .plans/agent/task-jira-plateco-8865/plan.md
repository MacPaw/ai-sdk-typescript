# Plan: Add Video Generation Client to Web SDK

## Context

The SDK currently contains no resource-specific HTTP clients — it is a Vercel AI SDK
wrapper focused on auth, retry, and middleware. Video generation requires a standalone
HTTP client that calls three async REST endpoints (create, poll-by-id, fetch-content)
against the AI Gateway. The implementation will follow the same pattern as
`gateway-fetch.ts`: a factory function that accepts `GatewayProviderSettings` (with a
required `baseURL`), resolves config via `resolveConfig`, and drives each API call through
`executeRequestPipeline`. New types, the client factory, and all public exports will live in
`src/gateway-video.ts`; tests mirror the style of the existing `gateway-fetch.spec.ts`.

## Required Tools

- pnpm --version

## Tasks

- [ ] Create `src/gateway-video.ts` with types and client factory
  - scope: `src/gateway-video.ts`
  - detail: Define `VideoStatus` const-object (pending/processing/completed/failed),
    `CreateVideoRequest` (model, prompt, plus optional fields such as aspect_ratio,
    duration_seconds, negative_prompt), `VideoJob` (id, status, model, prompt, created_at,
    updated_at, completed_at?, error?), `VideoContent` (id, content_type, data as
    ArrayBuffer, size), and `VideoClientOptions` (extends GatewayProviderSettings with
    baseURL required). Implement `createVideoClient(options): VideoClient` that returns an
    object with three methods using `executeRequestPipeline`:
    `createVideo(params): Promise<VideoJob>` → POST `{baseURL}/v1/videos`,
    `getVideo(videoId): Promise<VideoJob>` → GET `{baseURL}/v1/videos/{videoId}`,
    `getVideoContent(videoId): Promise<VideoContent>` → GET
    `{baseURL}/v1/videos/{videoId}/content`. Parse JSON for job responses; use
    `response.arrayBuffer()` + Content-Type header for content. Internally call
    `resolveConfig` and `executeRequestPipeline` exactly as `gateway-fetch.ts` does,
    with `includeAuth: true`, `normalizeErrors: true`, `allowAuthRetry: true`.
  - verification: `grep -n 'createVideoClient\|VideoStatus\|VideoJob\|VideoContent\|CreateVideoRequest' src/gateway-video.ts`

- [ ] Export video types and factory from `src/index.ts`
  - scope: `src/index.ts`
  - detail: Add a `// Video generation` section that re-exports `createVideoClient`,
    `VideoStatus`, and the types `VideoClientOptions`, `CreateVideoRequest`, `VideoJob`,
    `VideoContent` (using `export type` for interfaces).
  - verification: `grep -n 'createVideoClient\|VideoStatus\|VideoJob\|VideoContent' src/index.ts`

- [ ] Write unit tests in `src/__tests__/gateway-video.spec.ts`
  - scope: `src/__tests__/gateway-video.spec.ts`
  - detail: Follow `gateway-fetch.spec.ts` conventions — mock `globalThis.fetch` in
    `beforeEach` / restore in `afterEach`. Cover:
    1. `createVideo` sends a `POST` to `{baseURL}/v1/videos` with serialised body and
       `Content-Type: application/json`, returns parsed `VideoJob`.
    2. `getVideo` sends a `GET` to `{baseURL}/v1/videos/{id}`, returns parsed `VideoJob`.
    3. `getVideoContent` sends a `GET` to `{baseURL}/v1/videos/{id}/content`, returns a
       `VideoContent` with an `ArrayBuffer` and the correct `content_type`.
    4. Bearer token is injected into `Authorization` header on all three calls.
    5. A non-OK response (e.g. 404) throws an `AIGatewayError`.
    6. A 401 triggers one token-refresh retry (mock `getAuthToken` to return stale then
       fresh token, assert `fetch` was called twice).
    7. A 429 retries per the retry config and succeeds on the second attempt.
  - verification: `grep -n "describe\|it(" src/__tests__/gateway-video.spec.ts | head -40`

- [ ] Verify TypeScript compilation passes
  - scope: `src/gateway-video.ts`, `src/index.ts`, `src/__tests__/gateway-video.spec.ts`
  - verification: `pnpm typecheck`

- [ ] Verify all tests pass
  - scope: `src/__tests__/gateway-video.spec.ts`
  - verification: `pnpm test --run`

## Notes

- The OpenAPI YAML files (create-video, get-videos-by-video-id, get-videos-content-by-video-id)
  are in a private GitHub repo and were not directly readable. Types are modelled on the
  task description ("job/video ID", "status + metadata", "content fetched separately") and
  common video-generation API conventions. Adjust field names/shapes to match the actual
  spec once accessible.
- `getVideoContent` returns a parsed `VideoContent` object with `data: ArrayBuffer` rather
  than a raw `Response`, matching the SDK's convention of returning structured data. If
  the Gateway returns a redirect to a signed URL instead of binary data, the method may
  need to follow the redirect or return a URL string — record this as a known risk.
- No new NestJS module changes are needed; consumers can inject `VideoClientOptions` via
  existing `AI_GATEWAY_CONFIG` and call `createVideoClient` in their services.
- URL path convention inferred from existing routes (`/ai` baseURL + `/v1/...` sub-paths
  seen in test fixtures). Verify exact paths (`/v1/videos` vs `/api/v1/videos`) against
  the OpenAPI spec before releasing.
- Polling (repeatedly calling `getVideo` until status is `completed` or `failed`) is
  intentionally left to the caller — the SDK method is stateless, keeping it consistent
  with how the rest of the SDK is designed.
