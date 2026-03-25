import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { GATEWAY_PROVIDERS, createGatewayProvider } from '../gateway-provider';

function createMockProvider(): OpenAIProvider {
  const callable = vi.fn().mockReturnValue('model-instance');
  return Object.assign(callable, {
    languageModel: vi.fn().mockReturnValue('language-model'),
    chat: vi.fn().mockReturnValue('chat-model'),
    responses: vi.fn().mockReturnValue('responses-model'),
    completion: vi.fn().mockReturnValue('completion-model'),
    embedding: vi.fn().mockReturnValue('embedding-model'),
    embeddingModel: vi.fn().mockReturnValue('embedding-model'),
    textEmbedding: vi.fn().mockReturnValue('text-embedding-model'),
    textEmbeddingModel: vi.fn().mockReturnValue('text-embedding-model'),
    image: vi.fn().mockReturnValue('image-model'),
    imageModel: vi.fn().mockReturnValue('image-model'),
    transcription: vi.fn().mockReturnValue('transcription-model'),
    speech: vi.fn().mockReturnValue('speech-model'),
    tools: {},
  }) as unknown as OpenAIProvider;
}

vi.mock('../ai-gateway-provider', () => ({
  createAIGatewayProvider: vi.fn(),
}));

import { createAIGatewayProvider } from '../ai-gateway-provider';

const baseOptions = {
  getAuthToken: async () => 'token',
  env: 'production' as const,
};

describe('createGatewayProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefixes bare model IDs when called as function', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, baseOptions);
    provider('claude-sonnet-4-20250514');

    expect(mockProvider).toHaveBeenCalledWith('anthropic/claude-sonnet-4-20250514');
  });

  it('does not double-prefix model IDs that already contain a slash', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, baseOptions);
    provider('anthropic/claude-sonnet-4-20250514');

    expect(mockProvider).toHaveBeenCalledWith('anthropic/claude-sonnet-4-20250514');
  });

  it('prefixes when calling .languageModel()', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.GOOGLE, baseOptions);
    provider.languageModel('gemini-2.5-pro');

    expect(mockProvider.languageModel).toHaveBeenCalledWith('google/gemini-2.5-pro');
  });

  it('prefixes when calling .chat()', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.XAI, baseOptions);
    provider.chat('grok-3');

    expect(mockProvider.chat).toHaveBeenCalledWith('xai/grok-3');
  });

  it('prefixes when calling .embedding()', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.COHERE, baseOptions);
    provider.embedding('embed-english-v3.0');

    expect(mockProvider.embedding).toHaveBeenCalledWith('cohere/embed-english-v3.0');
  });

  it('prefixes when calling .image()', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.AZURE, baseOptions);
    provider.image('dall-e-3');

    expect(mockProvider.image).toHaveBeenCalledWith('azure/dall-e-3');
  });

  it('maps amazon-bedrock to the canonical bedrock prefix', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.AMAZON_BEDROCK, baseOptions);
    provider('anthropic.claude-v2');

    expect(mockProvider).toHaveBeenCalledWith('bedrock/anthropic.claude-v2');
  });

  it('uses required modelPrefix for openai-compatible providers', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.OPENAI_COMPATIBLE, {
      ...baseOptions,
      modelPrefix: 'fireworks_ai',
    });
    provider('accounts/fireworks/models/llama-v3p1-70b-instruct');

    expect(mockProvider).toHaveBeenCalledWith('accounts/fireworks/models/llama-v3p1-70b-instruct');
  });

  it('passes through provider options to createAIGatewayProvider without modelPrefix', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, {
      ...baseOptions,
      modelPrefix: 'custom',
      autoRefreshToken: false,
      tokenCacheTTL: 5000,
      retry: false,
      timeout: 15_000,
    });

    const passedOptions = vi.mocked(createAIGatewayProvider).mock.lastCall?.[0];
    if (!passedOptions) throw new Error('Expected createAIGatewayProvider to be called');
    expect(passedOptions).not.toHaveProperty('modelPrefix');
    expect(passedOptions.autoRefreshToken).toBe(false);
    expect(passedOptions.tokenCacheTTL).toBe(5000);
    expect(passedOptions.retry).toBe(false);
    expect(passedOptions.timeout).toBe(15_000);
  });

  it('supports "has" trap for property checks', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, baseOptions);
    expect('languageModel' in provider).toBe(true);
    expect('chat' in provider).toBe(true);
  });

  it('returns non-function properties as-is', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, baseOptions);
    expect(provider.tools).toEqual({});
  });

  it('does not prefix model IDs containing a slash in .languageModel()', () => {
    const mockProvider = createMockProvider();
    vi.mocked(createAIGatewayProvider).mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.GOOGLE, baseOptions);
    provider.languageModel('vertex_ai/gemini-pro');

    expect(mockProvider.languageModel).toHaveBeenCalledWith('vertex_ai/gemini-pro');
  });

  it('exposes stable provider constants', () => {
    expect(GATEWAY_PROVIDERS.ANTHROPIC).toBe('anthropic');
    expect(GATEWAY_PROVIDERS.AMAZON_BEDROCK).toBe('amazon-bedrock');
    expect(GATEWAY_PROVIDERS.OPENAI_COMPATIBLE).toBe('openai-compatible');
  });
});
