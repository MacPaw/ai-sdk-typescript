import { describe, it, expect, vi } from 'vitest';
import type { ProviderV3, RerankingModelV3 } from '@ai-sdk/provider';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { createAIGatewayCustomProvider } from '../custom-registry';

type MockProvider = OpenAIProvider &
  ProviderV3 & {
    transcription: ReturnType<typeof vi.fn>;
    speech: ReturnType<typeof vi.fn>;
    rerankingModel?: ReturnType<typeof vi.fn>;
  };

function createMockProvider(options?: { rerankingModel?: boolean }): MockProvider {
  const provider = Object.assign(vi.fn().mockReturnValue({ spec: 'lm' }), {
    languageModel: vi.fn().mockReturnValue({ spec: 'lm' }),
    chat: vi.fn(),
    responses: vi.fn(),
    completion: vi.fn(),
    embedding: vi.fn(),
    embeddingModel: vi.fn().mockReturnValue({ spec: 'embedding' }),
    textEmbedding: vi.fn(),
    textEmbeddingModel: vi.fn(),
    image: vi.fn(),
    imageModel: vi.fn().mockReturnValue({ spec: 'image' }),
    transcription: vi.fn().mockReturnValue({ spec: 'transcription' }),
    speech: vi.fn().mockReturnValue({ spec: 'speech' }),
    tools: {},
    specificationVersion: 'v3' as const,
  }) as unknown as MockProvider;

  if (options?.rerankingModel) {
    provider.rerankingModel = vi.fn().mockReturnValue({ spec: 'reranking' } as unknown as RerankingModelV3);
  }

  return provider;
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

    expect(mockCreateOpenAI).not.toHaveBeenCalled();
    expect(typeof registry.languageModel).toBe('function');
    expect(registry.languageModel('fast')).toBe(mockReturn);
    expect(mockCreateOpenAI).not.toHaveBeenCalled();
    expect((registry as ProviderV3).languageModel('openai/gpt-4.1-nano')).toStrictEqual({ spec: 'lm' });
    expect(mockCreateOpenAI).toHaveBeenCalledTimes(1);
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

  it('resolves lazy gateway provider factories only on fallback access', () => {
    const gateway = createMockProvider();
    const gatewayFactory = vi.fn().mockReturnValue(gateway);

    const registry = createAIGatewayCustomProvider(gatewayFactory, {
      languageModels: {
        fast: gateway as never,
      },
    });

    expect(gatewayFactory).not.toHaveBeenCalled();
    expect(registry.languageModel('fast')).toBe(gateway);
    expect(gatewayFactory).not.toHaveBeenCalled();

    expect((registry as ProviderV3).languageModel('openai/gpt-4.1-nano')).toStrictEqual(
      gateway.languageModel('openai/gpt-4.1-nano'),
    );
    expect(gatewayFactory).toHaveBeenCalledTimes(1);
  });

  it('forwards all supported fallback model families through the gateway provider', () => {
    const gateway = createMockProvider({
      rerankingModel: true,
    });
    const registry = createAIGatewayCustomProvider(gateway, {});
    const provider = registry as ProviderV3;

    expect(provider.embeddingModel('embed-model')).toStrictEqual({ spec: 'embedding' });
    expect(provider.imageModel('image-model')).toStrictEqual({ spec: 'image' });
    expect(provider.transcriptionModel!('transcription-model')).toStrictEqual({ spec: 'transcription' });
    expect(provider.speechModel!('speech-model')).toStrictEqual({ spec: 'speech' });
    expect(provider.rerankingModel!('rerank-model')).toStrictEqual({ spec: 'reranking' });

    expect(gateway.embeddingModel).toHaveBeenCalledWith('embed-model');
    expect(gateway.imageModel).toHaveBeenCalledWith('image-model');
    expect(gateway.transcription).toHaveBeenCalledWith('transcription-model');
    expect(gateway.speech).toHaveBeenCalledWith('speech-model');
    expect(gateway.rerankingModel!).toHaveBeenCalledWith('rerank-model');
  });

  it('throws a clear error when the fallback provider lacks reranking support', () => {
    const registry = createAIGatewayCustomProvider(createMockProvider(), {});
    const provider = registry as ProviderV3;

    expect(() => provider.rerankingModel!('rerank-model')).toThrow(
      'AI Gateway fallback provider does not implement rerankingModel()',
    );
  });
});
