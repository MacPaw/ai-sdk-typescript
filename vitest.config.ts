import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Subpaths that re-export matching `@ai-sdk/*` (see `package.json` exports). */
const providerMirrorSubpaths = [
  'xai',
  'groq',
  'mistral',
  'amazon-bedrock',
  'azure',
  'cohere',
  'perplexity',
  'deepseek',
  'togetherai',
  'openai-compatible',
] as const;

const providerMirrorAliases = Object.fromEntries(
  providerMirrorSubpaths.map((sub) => [`@macpaw/ai-sdk/${sub}`, resolve(__dirname, `./src/${sub}/index.ts`)]),
);

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/__tests__/**/*.spec.ts', 'src/**/__tests__/**/*.test.ts'],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@macpaw/ai-sdk/ai': resolve(__dirname, './src/provider/index.ts'),
      '@macpaw/ai-sdk/ai/internal': resolve(__dirname, './src/ai-internal.ts'),
      '@macpaw/ai-sdk/ai/test': resolve(__dirname, './src/ai-test.ts'),
      '@macpaw/ai-sdk/react': resolve(__dirname, './src/react/index.ts'),
      '@macpaw/ai-sdk/anthropic': resolve(__dirname, './src/anthropic/index.ts'),
      '@macpaw/ai-sdk/google': resolve(__dirname, './src/google/index.ts'),
      ...providerMirrorAliases,
    },
  },
});
