import { describe, it, expect } from 'vitest';
import * as root from '../index';
import * as provider from '../provider';

describe('root entry', () => {
  it('re-exports the Vercel-compatible provider surface plus shared helpers', () => {
    const providerKeys = Object.keys(provider).sort();
    const rootKeys = Object.keys(root).sort();
    const missingProviderKeys = providerKeys.filter((key) => !rootKeys.includes(key));

    expect(missingProviderKeys).toEqual([]);
    expect(root.AIGatewayError).toBeDefined();
    expect(root.ErrorCode).toBeDefined();
    expect(root.createAIGatewayProvider).toBe(provider.createAIGatewayProvider);
    expect(root.generateText).toBe(provider.generateText);
    expect(root.streamText).toBe(provider.streamText);
    expect(root.collectChatStream).toBeDefined();
    expect(root.SDKValidationError).toBeDefined();
  });

  it('keeps low-level client and runtime internals on explicit subpaths', () => {
    expect('createAIGatewayClient' in root).toBe(false);
    expect('resolveConfig' in root).toBe(false);
    expect('createFetchTransport' in root).toBe(false);
  });
});
