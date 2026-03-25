import { describe, it, expect } from 'vitest';
import * as provider from '../index';

describe('provider entry', () => {
  it('re-exports the full `ai` surface plus AI Gateway helpers', () => {
    expect(provider.createAIGatewayProvider).toBeDefined();
    expect(provider.createAIGatewayCustomProvider).toBeDefined();
    expect(provider.createAIGatewayDualProvider).toBeDefined();
    expect(provider.createGatewayProvider).toBeDefined();
    expect(provider.GATEWAY_PROVIDERS).toBeDefined();
    expect(provider.createAIGatewayFetch).toBeDefined();
    expect(provider.generateText).toBeDefined();
    expect(provider.streamText).toBeDefined();
    expect(provider.customProvider).toBeDefined();
    expect(provider.tool).toBeDefined();
    expect(provider.ErrorCode).toBeDefined();
    expect(provider.AIGatewayError).toBeDefined();
    // Spot-check additional `ai` exports beyond the former curated list
    expect(provider.rerank).toBeDefined();
    expect(provider.createUIMessageStream).toBeDefined();
    expect(provider.generateImage).toBeDefined();
  });

  it('does not expose the low-level Gateway client', () => {
    expect('createAIGatewayClient' in provider).toBe(false);
    expect('openai' in provider).toBe(false);
  });
});
