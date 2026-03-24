import { describe, it, expect } from 'vitest';
import * as clientEntry from '../client-entry';

describe('client entry', () => {
  it('exports the advanced low-level Gateway client surface', () => {
    expect(clientEntry.createAIGatewayClient).toBeDefined();
    expect(clientEntry.DEFAULT_BASE_URLS).toBeDefined();
    expect(clientEntry.API_PATHS).toBeDefined();
    expect(clientEntry.createFetchTransport).toBeDefined();
  });
});
