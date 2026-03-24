import { describe, it, expect, vi } from 'vitest';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { isOpenAIProvider, resolveAIGatewayProvider, resolveOpenAIProvider, resolveProviderSource } from '../provider-source';

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

describe('provider-source helpers', () => {
  it('resolves plain values and factories', () => {
    expect(resolveProviderSource('value')).toBe('value');
    expect(resolveProviderSource(() => 'factory')).toBe('factory');
  });

  it('detects OpenAI-compatible providers', () => {
    const provider = createMockProvider();
    expect(isOpenAIProvider(provider)).toBe(true);
    expect(isOpenAIProvider({ env: 'production', getAuthToken: async () => 'token' })).toBe(false);
  });

  it('reuses a prebuilt gateway provider', () => {
    const provider = createMockProvider();
    expect(resolveAIGatewayProvider(provider)).toBe(provider);
  });

  it('resolves gateway provider factories lazily', () => {
    const provider = createMockProvider();
    const factory = vi.fn().mockReturnValue(provider);

    expect(resolveAIGatewayProvider(factory)).toBe(provider);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('resolves direct OpenAI provider factories lazily', () => {
    const provider = createMockProvider();
    const factory = vi.fn().mockReturnValue(provider);

    expect(resolveOpenAIProvider(factory)).toBe(provider);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
