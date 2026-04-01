# Contributing

## Prerequisites

- Node.js 22+ for development (see `.nvmrc`). The SDK itself supports Node >=18 at runtime.
- pnpm (see `packageManager` in `package.json`)

## Setup

```bash
git clone https://github.com/macpaw/ai-sdk-typescript.git
cd ai-sdk-typescript
pnpm install
```

### Lint and format config

ESLint, Prettier, and TypeScript are configured directly in this repository via `eslint.config.js`, `.prettierrc`, and `tsconfig.json`. Keep `pnpm format:check` and `pnpm lint` both green after edits.

## Development workflow

```bash
pnpm dev          # watch mode (rebuild on change)
pnpm typecheck    # TypeScript type checking
pnpm lint         # ESLint
pnpm lint:fix     # ESLint with auto-fix
pnpm test         # run tests
pnpm test:watch   # run tests in watch mode
pnpm test:coverage # run tests with coverage
pnpm build        # production build
```

## Commit conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by [semantic-release](https://semantic-release.gitbook.io/).

```
feat: add streaming support for audio API
fix: handle empty response body in SSE parser
perf: reduce bundle size by tree-shaking unused codecs
docs: update retry configuration examples
test: add coverage for rate-limit retry logic
chore(deps): update vitest to v3
refactor: extract middleware chain into separate module
```

For breaking changes, add `!` after the type:

```
feat!: rename createClient to createAIGatewayClient
```

## Branch strategy

| Branch | Purpose         | npm tag  |
| ------ | --------------- | -------- |
| `main` | Stable releases | `latest` |

Feature and fix branches use the pattern `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, etc.

## Pull requests

1. Branch from `main`
2. Make your changes
3. Ensure all checks pass: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`
4. Open a PR against `main`
5. Fill in the PR template

## Tests

Place specs next to the feature they cover using a `__tests__` directory (e.g. `src/__tests__/gateway-fetch.spec.ts`). `vitest.config.ts` picks up `src/**/__tests__/**/*.spec.ts` and `src/**/__tests__/**/*.test.ts`.

## Project structure

```
src/
├── gateway-config.ts   # GatewayProviderSettings, resolveConfig, retry defaults
├── gateway-errors.ts   # AIGatewayError family, ErrorCode, parsers
├── gateway-fetch.ts    # createGatewayFetch (custom fetch for OpenAI SDK / raw HTTP)
├── gateway-provider.ts # createAIGatewayProvider, createGatewayProvider, GATEWAY_PROVIDERS
├── gateway-request.ts  # executeRequestPipeline (internal; not re-exported from root)
├── gateway-retry.ts    # withRetry
├── index.ts            # Public API — @macpaw/ai-sdk
└── nestjs/             # @macpaw/ai-sdk/nestjs
```

Add behavior beside the smallest module that owns it; avoid new public entry points unless `package.json` `exports` and tests are updated together.
