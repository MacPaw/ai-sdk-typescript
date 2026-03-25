import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

type PackageExports = Record<
  string,
  string | { import?: { types?: string; default?: string }; require?: { types?: string; default?: string } }
>;

const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')) as {
  exports: PackageExports;
  files: string[];
};

describe('package exports', () => {
  it('keeps the release-critical entrypoints in the export map', () => {
    for (const subpath of [
      '.',
      './ai',
      './ai/internal',
      './ai/test',
      './client',
      './runtime',
      './testing',
      './react',
    ]) {
      expect(packageJson.exports[subpath]).toBeDefined();
    }
  });

  it('publishes the folders required for built code and shimmed ai subpaths', () => {
    expect(packageJson.files).toContain('dist');
    expect(packageJson.files).toContain('shims');
  });
});
