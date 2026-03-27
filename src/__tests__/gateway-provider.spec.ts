import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { GATEWAY_PROVIDERS, createGatewayProvider, createAIGatewayProvider } from '../gateway-provider';

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

const baseOptions = {
  getAuthToken: async () => 'token',
  env: 'production' as const,
};

// ─── createAIGatewayProvider ──────────────────────────────────────────────────

describe('createAIGatewayProvider', () => {
  it('throws when neither baseURL nor env is provided', () => {
    const mockCreateOpenAI = vi.fn().mockImplementation(() => createMockProvider());
    expect(() =>
      createAIGatewayProvider({
        createOpenAI: mockCreateOpenAI as never,
        getAuthToken: async () => 'token',
      }),
    ).toThrow('requires baseURL or env');
  });

  it('calls custom createOpenAI with correct baseURL from env', () => {
    const mockReturn = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockReturn);

    createAIGatewayProvider({
      createOpenAI: mockCreateOpenAI as never,
      env: 'production',
      getAuthToken: async () => 'token',
    });

    expect(mockCreateOpenAI).toHaveBeenCalledTimes(1);
    const config = mockCreateOpenAI.mock.calls[0][0];
    expect(config.baseURL).toBe('https://api.macpaw.com/ai/api/v1');
    expect(config.apiKey).toBe('ai-gateway-auth-via-fetch');
    expect(typeof config.fetch).toBe('function');
  });

  it('uses builtin @ai-sdk/openai when createOpenAI is not provided', () => {
    const provider = createAIGatewayProvider({
      env: 'production',
      getAuthToken: async () => 'token',
    });

    expect(typeof provider).toBe('function');
    expect(typeof provider.chat).toBe('function');
    expect(typeof provider.completion).toBe('function');
    expect(typeof provider.embedding).toBe('function');
  });

  it('uses explicit baseURL over env', () => {
    const mockReturn = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockReturn);

    createAIGatewayProvider({
      createOpenAI: mockCreateOpenAI as never,
      baseURL: 'https://custom.gateway.com/ai',
      getAuthToken: async () => 'token',
    });

    const config = mockCreateOpenAI.mock.calls[0][0];
    expect(config.baseURL).toBe('https://custom.gateway.com/ai/api/v1');
  });

  it('returns the result of createOpenAI', () => {
    const mockReturn = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockReturn);

    const provider = createAIGatewayProvider({
      createOpenAI: mockCreateOpenAI as never,
      env: 'production',
      getAuthToken: async () => 'token',
    });

    expect(provider).toBe(mockReturn);
    expect(provider('gpt-4')).toBe('model-instance');
  });

  it('passes normalizeErrors option through to fetch config', () => {
    const mockReturn = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockReturn);

    createAIGatewayProvider({
      createOpenAI: mockCreateOpenAI as never,
      env: 'production',
      getAuthToken: async () => 'token',
      normalizeErrors: false,
    });

    const config = mockCreateOpenAI.mock.calls[0][0];
    expect(typeof config.fetch).toBe('function');
  });
});

// ─── createGatewayProvider ────────────────────────────────────────────────────

describe('createGatewayProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefixes bare model IDs when called as function', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, { ...baseOptions, createOpenAI: mockCreateOpenAI as never });
    provider('claude-sonnet-4-20250514');

    expect(mockProvider).toHaveBeenCalledWith('anthropic/claude-sonnet-4-20250514');
  });

  it('does not double-prefix model IDs that already contain a slash', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, { ...baseOptions, createOpenAI: mockCreateOpenAI as never });
    provider('anthropic/claude-sonnet-4-20250514');

    expect(mockProvider).toHaveBeenCalledWith('anthropic/claude-sonnet-4-20250514');
  });

  it('prefixes when calling .languageModel()', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.GOOGLE, { ...baseOptions, createOpenAI: mockCreateOpenAI as never });
    provider.languageModel('gemini-2.5-pro');

    expect(mockProvider.languageModel).toHaveBeenCalledWith('google/gemini-2.5-pro');
  });

  it('prefixes when calling .chat()', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.XAI, { ...baseOptions, createOpenAI: mockCreateOpenAI as never });
    provider.chat('grok-3');

    expect(mockProvider.chat).toHaveBeenCalledWith('xai/grok-3');
  });

  it('prefixes when calling .embedding()', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.COHERE, { ...baseOptions, createOpenAI: mockCreateOpenAI as never });
    provider.embedding('embed-english-v3.0');

    expect(mockProvider.embedding).toHaveBeenCalledWith('cohere/embed-english-v3.0');
  });

  it('prefixes when calling .image()', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.AZURE, { ...baseOptions, createOpenAI: mockCreateOpenAI as never });
    provider.image('dall-e-3');

    expect(mockProvider.image).toHaveBeenCalledWith('azure/dall-e-3');
  });

  it('maps amazon-bedrock to the canonical bedrock prefix', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.AMAZON_BEDROCK, { ...baseOptions, createOpenAI: mockCreateOpenAI as never });
    provider('anthropic.claude-v2');

    expect(mockProvider).toHaveBeenCalledWith('bedrock/anthropic.claude-v2');
  });

  it('uses required modelPrefix for openai-compatible providers', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.OPENAI_COMPATIBLE, {
      ...baseOptions,
      createOpenAI: mockCreateOpenAI as never,
      modelPrefix: 'fireworks_ai',
    });
    provider('accounts/fireworks/models/llama-v3p1-70b-instruct');

    expect(mockProvider).toHaveBeenCalledWith('accounts/fireworks/models/llama-v3p1-70b-instruct');
  });

  it('passes through provider options without modelPrefix', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, {
      ...baseOptions,
      createOpenAI: mockCreateOpenAI as never,
      modelPrefix: 'custom',
      retry: false,
      timeout: 15_000,
    });
    provider('claude-opus-4');

    // modelPrefix is NOT forwarded to createAIGatewayProvider; prefix is 'custom'
    expect(mockProvider).toHaveBeenCalledWith('custom/claude-opus-4');
    // createOpenAI was called with correct baseURL (production env)
    const config = mockCreateOpenAI.mock.calls[0][0];
    expect(config.baseURL).toContain('/api/v1');
  });

  it('supports "has" trap for property checks', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, { ...baseOptions, createOpenAI: mockCreateOpenAI as never });
    expect('languageModel' in provider).toBe(true);
    expect('chat' in provider).toBe(true);
  });

  it('returns non-function properties as-is', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, { ...baseOptions, createOpenAI: mockCreateOpenAI as never });
    expect(provider.tools).toEqual({});
  });

  it('does not prefix model IDs containing a slash in .languageModel()', () => {
    const mockProvider = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockProvider);

    const provider = createGatewayProvider(GATEWAY_PROVIDERS.GOOGLE, { ...baseOptions, createOpenAI: mockCreateOpenAI as never });
    provider.languageModel('vertex_ai/gemini-pro');

    expect(mockProvider.languageModel).toHaveBeenCalledWith('vertex_ai/gemini-pro');
  });

  it('exposes stable provider constants', () => {
    expect(GATEWAY_PROVIDERS.ANTHROPIC).toBe('anthropic');
    expect(GATEWAY_PROVIDERS.AMAZON_BEDROCK).toBe('amazon-bedrock');
    expect(GATEWAY_PROVIDERS.OPENAI_COMPATIBLE).toBe('openai-compatible');
  });
});
