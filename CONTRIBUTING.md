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

| Branch    | Purpose            | npm tag  |
| --------- | ------------------ | -------- |
| `main`    | Stable releases    | `latest` |
| `develop` | Release candidates | `rc`     |
| `beta`    | Beta releases      | `beta`   |

## Pull requests

1. Branch from `develop`
2. Make your changes
3. Ensure all checks pass: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`
4. Open a PR against `develop`
5. Fill in the PR template

## Tests

Place specs next to the feature they cover using a `__tests__` directory (e.g. `src/runtime/__tests__/errors.spec.ts`). `vitest.config.ts` picks up `src/**/__tests__/**/*.spec.ts` and `src/**/__tests__/**/*.test.ts`.

## Project structure

```
src/
├── client-entry.ts   # `@macpaw/ai-sdk/client` advanced entry point
├── client/
│   ├── api/       # HTTP facades for gateway endpoints (chat, responses, embeddings, …)
│   └── index.ts   # createAIGatewayClient and public client interfaces
├── runtime/       # Canonical internal runtime layer: config, request pipeline, transport, errors
├── core/          # Backward-compatible facade for advanced/internal runtime exports
├── types/         # Domain TypeScript types (`@macpaw/ai-sdk/types`)
├── nestjs/        # NestJS module integration
├── provider/      # Primary Vercel AI SDK product surface
├── transport/     # Compatibility wrapper for transport exports
├── testing/       # Provider/client mocks and test helpers
├── helpers.ts     # Shared stream helpers
└── index.ts       # Slim shared root surface (errors, enums, helpers)
```

When adding code, keep **domain types** in `src/types/`, **gateway HTTP calls** in `src/client/api/`, and **shared runtime** (fetch pipeline, SSE, retries) in `src/runtime/`. `src/provider/` is the primary app-facing integration surface, `src/client-entry.ts` is the explicit advanced client entry, and `src/core/` is the compatibility-facing facade; avoid adding new implementation code there.
