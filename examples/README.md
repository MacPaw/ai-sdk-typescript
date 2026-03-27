# Examples

Small scripts that mirror the supported integration paths:

- `vercel-provider.mjs` — `generateText` / `streamText` from `ai` + `createAIGatewayProvider` from `@macpaw/ai-sdk`
- `nestjs/` — copy-ready NestJS module / controller / service (uses `@macpaw/ai-sdk/nestjs` + `@macpaw/ai-sdk`)

## Run

From the repository root:

```bash
export AI_GATEWAY_TOKEN="your-token"
pnpm example:provider
```

The script runs `pnpm build` first so Node resolves the package like a consumer app.

Optional:

- `AI_GATEWAY_BASE_URL` — custom gateway root instead of `env: 'production'`
- `AI_GATEWAY_MODEL` — default `openai/gpt-4.1-nano`

The NestJS sample is documented in [`examples/nestjs/README.md`](./nestjs/README.md); copy it into a real Nest app rather than running it from this repo alone.
