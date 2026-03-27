import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/',
      'tmp/',
      '.claude/',
      'node_modules/',
      'scripts/',
      'vendor/',
      '*.cjs',
      'eslint.config.js',
      'tsup.config.ts',
      'vitest.config.ts',
    ],
  },
  {
    files: ['examples/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
);
