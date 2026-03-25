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
    for (const subpath of ['.', './provider', './client', './runtime', './testing', './react']) {
      expect(packageJson.exports[subpath]).toBeDefined();
    }
  });

  it('does not expose deprecated ai compatibility subpaths', () => {
    expect(packageJson.exports['./ai']).toBeUndefined();
    expect(packageJson.exports['./ai/internal']).toBeUndefined();
    expect(packageJson.exports['./ai/test']).toBeUndefined();
  });

  it('publishes the folders required for built code', () => {
    expect(packageJson.files).toContain('dist');
    expect(packageJson.files).not.toContain('shims');
  });
});
