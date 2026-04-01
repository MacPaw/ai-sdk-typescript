import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/__tests__/**/*.spec.ts', 'src/**/__tests__/**/*.test.ts'],
    passWithNoTests: false,
  },
});
