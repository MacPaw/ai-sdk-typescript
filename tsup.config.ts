import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'client/index': 'src/client-entry.ts',
    'runtime/index': 'src/runtime/index.ts',
    'types/index': 'src/types/index.ts',
    'provider/index': 'src/provider/index.ts',
    'nestjs/index': 'src/nestjs/index.ts',
    'testing/index': 'src/testing/index.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
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
