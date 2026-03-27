import { describe, it, expect } from 'vitest';
import * as runtimeEntry from '../runtime';

describe('runtime entry', () => {
  it('exports core runtime primitives', () => {
    expect(runtimeEntry.DEFAULT_BASE_URLS).toBeDefined();
    expect(runtimeEntry.createFetchTransport).toBeDefined();
    expect(runtimeEntry.AIGatewayError).toBeDefined();
  });

  it('does not export removed primitives', () => {
    expect('SDKValidationError' in runtimeEntry).toBe(false);
    expect('API_PATHS' in runtimeEntry).toBe(false);
  });
});
