import { describe, it, expect, vi } from 'vitest';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { createAIGatewayCustomProvider } from '../custom-registry';

function createMockProvider(): OpenAIProvider {
  const callable = vi.fn().mockReturnValue({ spec: 'lm' });

  return Object.assign(callable, {
    languageModel: vi.fn().mockReturnValue({ spec: 'lm' }),
    chat: vi.fn(),
    responses: vi.fn(),
    completion: vi.fn(),
    embedding: vi.fn(),
    embeddingModel: vi.fn(),
    textEmbedding: vi.fn(),
    textEmbeddingModel: vi.fn(),
    image: vi.fn(),
    imageModel: vi.fn(),
    transcription: vi.fn(),
    speech: vi.fn(),
    tools: {},
  }) as unknown as OpenAIProvider;
}

describe('createAIGatewayCustomProvider', () => {
  it('returns a provider with languageModel and uses gateway options as fallback', () => {
    const mockReturn = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockReturn);

    const registry = createAIGatewayCustomProvider(
      {
        createOpenAI: mockCreateOpenAI as never,
        env: 'production',
        getAuthToken: async () => 'token',
      },
      {
        languageModels: {
          fast: mockReturn as never,
        },
      },
    );

    expect(mockCreateOpenAI).toHaveBeenCalledTimes(1);
    expect(typeof registry.languageModel).toBe('function');
    expect(registry.languageModel('fast')).toBe(mockReturn);
  });

  it('reuses a prebuilt gateway provider without rebuilding it', () => {
    const gateway = createMockProvider();

    const registry = createAIGatewayCustomProvider(gateway, {
      languageModels: {
        fast: gateway as never,
      },
    });

    expect(registry.languageModel('fast')).toBe(gateway);
  });

  it('supports lazy gateway provider factories', () => {
    const gateway = createMockProvider();
    const gatewayFactory = vi.fn().mockReturnValue(gateway);

    const registry = createAIGatewayCustomProvider(gatewayFactory, {
      languageModels: {
        fast: gateway as never,
      },
    });

    expect(gatewayFactory).toHaveBeenCalledTimes(1);
    expect(registry.languageModel('fast')).toBe(gateway);
  });
});
