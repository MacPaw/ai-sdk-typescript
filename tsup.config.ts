import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'provider/index': 'src/provider/index.ts',
    'nestjs/index': 'src/nestjs/index.ts',
    'testing/index': 'src/testing/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  treeshake: true,
  minify: false,
  outDir: 'dist',
  esbuildOptions(options) {
    options.conditions = ['import', 'require', 'default'];
  },
});
