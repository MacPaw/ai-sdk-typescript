import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    },
  },
});
