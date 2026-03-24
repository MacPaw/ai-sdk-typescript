import { describe, it, expect } from 'vitest';
import * as runtimeEntry from '../runtime';

describe('runtime entry', () => {
  it('exports the advanced runtime surface explicitly', () => {
    expect(runtimeEntry.DEFAULT_BASE_URLS).toBeDefined();
    expect(runtimeEntry.API_PATHS).toBeDefined();
    expect(runtimeEntry.createFetchTransport).toBeDefined();
    expect(runtimeEntry.SDKValidationError).toBeDefined();
  });
});
