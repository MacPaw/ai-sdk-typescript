import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/',
      'node_modules/',
      'scripts/',
      'vendor/',
      '*.cjs',
      'eslint.config.js',
      'stylelint.config.js',
      'tsup.config.ts',
      'vitest.config.ts',
    ],
  },
);
