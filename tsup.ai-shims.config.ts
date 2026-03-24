import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'ai/internal': 'src/ai-internal.ts',
    'ai/test': 'src/ai-test.ts',
  },
  format: ['esm', 'cjs'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: false,
  target: 'es2020',
  outDir: 'dist',
  esbuildOptions(options) {
    options.conditions = ['import', 'require', 'default'];
  },
});
