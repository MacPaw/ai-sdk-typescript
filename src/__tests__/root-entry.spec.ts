import { describe, it, expect } from 'vitest';
import * as root from '../index';

describe('root entry', () => {
  it('exports the gateway provider surface', () => {
    expect(root.AIGatewayError).toBeDefined();
    expect(root.GatewayApiCode).toBeDefined();
    expect(root.createAIGatewayProvider).toBeDefined();
    expect(root.createGatewayProvider).toBeDefined();
    expect(root.GATEWAY_PROVIDERS).toBeDefined();
    expect(root.createGatewayFetch).toBeDefined();
    expect(root.GATEWAY_PLACEHOLDER_API_KEY).toBeDefined();
  });

  it('does not expose low-level internals or upstream helpers', () => {
    expect('parseStreamErrorPayload' in root).toBe(false);
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
