# Examples

These examples are intentionally small and mirror the primary integration paths:

- `mock-transport.mjs` — fully local demo with `createMockTransport`, no network or token needed
- `node-client.mjs` — direct HTTP client usage with `@macpaw/ai-sdk/client`
- `vercel-provider.mjs` — Vercel AI SDK-style usage with `@macpaw/ai-sdk/provider`
- `nestjs/` — copy-ready NestJS module/controller/service example

## Run them

From the repository root:

```bash
pnpm example:mock
```

For the real Gateway examples, set your token first:

```bash
export AI_GATEWAY_TOKEN="your-token"
pnpm example:client
pnpm example:provider
```

Optional environment variables:

- `AI_GATEWAY_BASE_URL` — use a custom or staging gateway URL instead of `env: 'production'`
- `AI_GATEWAY_MODEL` — override the default model id (`openai/gpt-4.1-nano`)

Each example runs `pnpm build` first so it can import the package through its published-style export paths.

The NestJS example is documented in [`examples/nestjs/README.md`](./nestjs/README.md) because it is meant to be copied into a real Nest app rather than run directly from this repository.
