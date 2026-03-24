import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'client/index': 'src/client-entry.ts',
    'core/index': 'src/core/index.ts',
    'runtime/index': 'src/runtime/index.ts',
    'types/index': 'src/types/index.ts',
    'provider/index': 'src/provider/index.ts',
    'nestjs/index': 'src/nestjs/index.ts',
    'testing/index': 'src/testing/index.ts',
    'react/index': 'src/react/index.ts',
    'anthropic/index': 'src/anthropic/index.ts',
    'google/index': 'src/google/index.ts',
    'xai/index': 'src/xai/index.ts',
    'groq/index': 'src/groq/index.ts',
    'mistral/index': 'src/mistral/index.ts',
    'amazon-bedrock/index': 'src/amazon-bedrock/index.ts',
    'azure/index': 'src/azure/index.ts',
    'cohere/index': 'src/cohere/index.ts',
    'perplexity/index': 'src/perplexity/index.ts',
    'deepseek/index': 'src/deepseek/index.ts',
    'togetherai/index': 'src/togetherai/index.ts',
    'openai-compatible/index': 'src/openai-compatible/index.ts',
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
