# NestJS Example

This folder shows the recommended NestJS integration shape for `@macpaw/ai-sdk`.

It is a copy-ready reference example, not a standalone package in this repository.
To run it in a real NestJS app, install the usual Nest runtime dependencies in your app:

```bash
pnpm add @macpaw/ai-sdk @nestjs/common @nestjs/core @nestjs/platform-express rxjs
```

Then copy the files from this folder into your NestJS project.

## Files

- `app.module.ts` — registers `AIGatewayModule`
- `chat.service.ts` — injects `GatewayProviderSettings` and builds `createAIGatewayProvider` per call
- `chat.controller.ts` — exposes a simple `/chat` endpoint and applies the exception filter
- `main.ts` — standard Nest bootstrap

## Environment variables

- `AI_GATEWAY_TOKEN` or `SETAPP_TOKEN`
- `AI_GATEWAY_BASE_URL` (optional; use for staging/custom gateway URL)
- `AI_GATEWAY_MODEL` (optional; defaults to `openai/gpt-4.1-nano`)
