import { describe, it, expect } from 'vitest';
import * as provider from '../index';

describe('provider entry', () => {
  it('exports the curated provider platform', () => {
    expect(provider.createAIGatewayProvider).toBeDefined();
    expect(provider.createAIGatewayCustomProvider).toBeDefined();
    expect(provider.createAIGatewayDualProvider).toBeDefined();
    expect(provider.createAIGatewayFetch).toBeDefined();
    expect(provider.generateText).toBeDefined();
    expect(provider.streamText).toBeDefined();
    expect(provider.customProvider).toBeDefined();
    expect(provider.tool).toBeDefined();
    expect(provider.ErrorCode).toBeDefined();
    expect(provider.AIGatewayError).toBeDefined();
  });

  it('does not expose the low-level Gateway client', () => {
    expect('createAIGatewayClient' in provider).toBe(false);
  });
});
