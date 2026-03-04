# Contributing

## Prerequisites

- Node.js 22+ for development (see `.nvmrc`). The SDK itself supports Node >=18 at runtime.
- pnpm (see `packageManager` in `package.json`)

## Setup

```bash
git clone https://github.com/macpaw/ai-sdk.git
cd ai-sdk
pnpm install
```

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

| Branch | Purpose | npm tag |
|--------|---------|---------|
| `main` | Stable releases | `latest` |
| `develop` | Release candidates | `rc` |
| `beta` | Beta releases | `beta` |

## Pull requests

1. Branch from `develop`
2. Make your changes
3. Ensure all checks pass: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
4. Open a PR against `develop`
5. Fill in the PR template

## Project structure

```
src/
├── api/           # API resource classes (chat, responses, embeddings, etc.)
├── core/          # Config, errors, retry, SSE parser, validation
├── nestjs/        # NestJS module integration
├── provider/      # Vercel AI SDK provider
├── transport/     # HTTP transport layer
├── client.ts      # Main client factory
├── helpers.ts     # Utility functions
└── index.ts       # Public API exports
```
