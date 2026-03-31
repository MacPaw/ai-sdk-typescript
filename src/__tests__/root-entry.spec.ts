import { describe, it, expect } from 'vitest';
import * as root from '../index';
import * as provider from '../provider';

describe('root entry', () => {
  it('re-exports the MacPaw provider surface plus shared helpers', () => {
    const providerKeys = Object.keys(provider).sort();
    const rootKeys = Object.keys(root).sort();
    const missingProviderKeys = providerKeys.filter((key) => !rootKeys.includes(key));

    expect(missingProviderKeys).toEqual([]);
    expect(root.AIGatewayError).toBeDefined();
    expect(root.ErrorCode).toBeDefined();
    expect(root.createAIGatewayProvider).toBe(provider.createAIGatewayProvider);
    expect(root.collectResponseStream).toBeDefined();
    expect(root.SDKValidationError).toBeDefined();
  });

  it('keeps upstream ai helpers and low-level internals on explicit packages/subpaths', () => {
    expect('generateText' in root).toBe(false);
    expect('streamText' in root).toBe(false);
    expect('createOpenAI' in root).toBe(false);
    expect('createAIGatewayClient' in root).toBe(false);
    expect('resolveConfig' in root).toBe(false);
    expect('createFetchTransport' in root).toBe(false);
  });
});
