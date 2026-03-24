import { describe, it, expect } from 'vitest';
import * as clientEntry from '../client-entry';

describe('client entry', () => {
  it('exports the focused low-level Gateway client surface', () => {
    expect(clientEntry.createAIGatewayClient).toBeDefined();
    expect('DEFAULT_BASE_URLS' in clientEntry).toBe(false);
    expect('API_PATHS' in clientEntry).toBe(false);
    expect('createFetchTransport' in clientEntry).toBe(false);
    expect('SDKValidationError' in clientEntry).toBe(false);
  });
});
