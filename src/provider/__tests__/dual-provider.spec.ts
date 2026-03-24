import { describe, it, expect, vi } from 'vitest';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { createAIGatewayDualProvider } from '../dual-provider';

function createMockProvider(label: string): OpenAIProvider {
  const callable = vi.fn().mockReturnValue(`${label}-call`);

  return Object.assign(callable, {
    languageModel: vi.fn().mockReturnValue(`${label}-language`),
    chat: vi.fn().mockReturnValue(`${label}-chat`),
    responses: vi.fn().mockReturnValue(`${label}-responses`),
    completion: vi.fn().mockReturnValue(`${label}-completion`),
    embedding: vi.fn().mockReturnValue(`${label}-embedding`),
    embeddingModel: vi.fn().mockReturnValue(`${label}-embeddingModel`),
    textEmbedding: vi.fn().mockReturnValue(`${label}-textEmbedding`),
    textEmbeddingModel: vi.fn().mockReturnValue(`${label}-textEmbeddingModel`),
    image: vi.fn().mockReturnValue(`${label}-image`),
    imageModel: vi.fn().mockReturnValue(`${label}-imageModel`),
    transcription: vi.fn().mockReturnValue(`${label}-transcription`),
    speech: vi.fn().mockReturnValue(`${label}-speech`),
    tools: { label },
  }) as unknown as OpenAIProvider;
}

describe('createAIGatewayDualProvider', () => {
  it('uses the direct provider when useGateway is false', () => {
    const gateway = createMockProvider('gateway');
    const direct = createMockProvider('direct');

    const provider = createAIGatewayDualProvider({
      useGateway: false,
      gateway,
      direct,
    });

    expect(provider('openai/gpt-4.1-nano')).toBe('direct-call');
    expect(provider.chat('openai/gpt-4.1-nano')).toBe('direct-chat');
  });

  it('uses the gateway provider when useGateway is true', () => {
    const gateway = createMockProvider('gateway');
    const direct = createMockProvider('direct');

    const provider = createAIGatewayDualProvider({
      useGateway: true,
      gateway,
      direct,
    });

    expect(provider('openai/gpt-4.1-nano')).toBe('gateway-call');
    expect(provider.embedding('text-embedding-3-small')).toBe('gateway-embedding');
  });

  it('supports lazy environment checks', () => {
    const gateway = createMockProvider('gateway');
    const direct = createMockProvider('direct');
    let useGateway = false;

    const provider = createAIGatewayDualProvider({
      useGateway: () => useGateway,
      gateway,
      direct,
    });

    expect(provider('openai/gpt-4.1-nano')).toBe('direct-call');
    useGateway = true;
    expect(provider('openai/gpt-4.1-nano')).toBe('gateway-call');
    expect(provider.tools).toEqual({ label: 'gateway' });
  });
});
