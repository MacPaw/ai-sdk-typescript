import { describe, it, expect } from 'vitest';
import * as provider from '../index';

describe('provider entry', () => {
  it('exports the MacPaw gateway provider helpers only', () => {
    expect(provider.createAIGatewayProvider).toBeDefined();
    expect(provider.createAIGatewayCustomProvider).toBeDefined();
    expect(provider.createAIGatewayDualProvider).toBeDefined();
    expect(provider.createGatewayProvider).toBeDefined();
    expect(provider.GATEWAY_PROVIDERS).toBeDefined();
    expect(provider.createAIGatewayFetch).toBeDefined();
    expect(provider.ErrorCode).toBeDefined();
    expect(provider.GatewayApiCode).toBeDefined();
    expect(provider.AIGatewayError).toBeDefined();
    expect(provider.GatewayValidationError).toBeDefined();
  });

  it('does not expose upstream ai helpers or the low-level Gateway client', () => {
    expect('createAIGatewayClient' in provider).toBe(false);
    expect('openai' in provider).toBe(false);
    expect('generateText' in provider).toBe(false);
    expect('streamText' in provider).toBe(false);
    expect('customProvider' in provider).toBe(false);
    expect('createOpenAI' in provider).toBe(false);
  });
});
