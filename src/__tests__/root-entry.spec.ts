import { describe, it, expect } from 'vitest';
import * as root from '../index';

describe('root entry', () => {
  it('exports shared error and helper surface', () => {
    expect(root.AIGatewayError).toBeDefined();
    expect(root.ErrorCode).toBeDefined();
    expect(root.collectChatStream).toBeDefined();
    expect(root.SDKValidationError).toBeDefined();
  });

  it('does not expose the low-level HTTP client from the root package', () => {
    expect('createAIGatewayClient' in root).toBe(false);
    expect('resolveConfig' in root).toBe(false);
    expect('createFetchTransport' in root).toBe(false);
  });
});
