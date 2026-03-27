import { describe, it, expect } from 'vitest';
import * as root from '../index';
import * as provider from '../provider';

describe('root entry', () => {
  it('re-exports the provider surface', () => {
    const providerKeys = Object.keys(provider).sort();
    const rootKeys = Object.keys(root).sort();
    const missingProviderKeys = providerKeys.filter((key) => !rootKeys.includes(key));

    expect(missingProviderKeys).toEqual([]);
    expect(root.AIGatewayError).toBeDefined();
    expect(root.GatewayApiCode).toBeDefined();
    expect(root.createAIGatewayProvider).toBe(provider.createAIGatewayProvider);
  });

  it('does not expose low-level internals or upstream helpers', () => {
    expect('generateText' in root).toBe(false);
    expect('streamText' in root).toBe(false);
    expect('createOpenAI' in root).toBe(false);
    expect('createAIGatewayClient' in root).toBe(false);
    expect('resolveConfig' in root).toBe(false);
    expect('createFetchTransport' in root).toBe(false);
    expect('collectResponseStream' in root).toBe(false);
    expect('SDKValidationError' in root).toBe(false);
  });
});
