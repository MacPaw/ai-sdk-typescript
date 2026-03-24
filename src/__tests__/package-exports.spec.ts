import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

type PackageExports = Record<
  string,
  string | { import?: { types?: string; default?: string }; require?: { types?: string; default?: string } }
>;

const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
) as {
  exports: PackageExports;
  files: string[];
};

const providerMirrorSubpaths = [
  'anthropic',
  'google',
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

function sourceFileExists(relativePath: string): boolean {
  return existsSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)));
}

describe('package exports', () => {
  it('keeps the release-critical entrypoints in the export map', () => {
    for (const subpath of ['.', './ai', './ai/internal', './ai/test', './client', './runtime', './testing', './react']) {
      expect(packageJson.exports[subpath]).toBeDefined();
    }
  });

  it('keeps provider mirror subpaths aligned with source entries and dist targets', () => {
    for (const subpath of providerMirrorSubpaths) {
      const exportKey = `./${subpath}`;
      const exportConfig = packageJson.exports[exportKey];

      expect(exportConfig).toBeDefined();
      expect(sourceFileExists(`${subpath}/index.ts`)).toBe(true);
      expect(exportConfig).toEqual({
        import: {
          types: `./dist/${subpath}/index.d.ts`,
          default: `./dist/${subpath}/index.js`,
        },
        require: {
          types: `./dist/${subpath}/index.d.cts`,
          default: `./dist/${subpath}/index.cjs`,
        },
      });
    }
  });

  it('publishes the folders required for built code and shimmed ai subpaths', () => {
    expect(packageJson.files).toContain('dist');
    expect(packageJson.files).toContain('shims');
  });
});
