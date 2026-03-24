import { describe, it, expect, vi } from 'vitest';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { createAIGatewayProvider } from '../ai-gateway-provider';

function createMockProvider(): OpenAIProvider {
  const callable = vi.fn().mockReturnValue('model-instance');
  return Object.assign(callable, {
    languageModel: vi.fn(),
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
    expect(config.apiKey).toBe('unused');
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

  it('honors apiVersion when provided', () => {
    const mockReturn = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockReturn);

    createAIGatewayProvider({
      createOpenAI: mockCreateOpenAI as never,
      baseURL: 'https://custom.gateway.com/ai',
      apiVersion: 'v2',
      getAuthToken: async () => 'token',
    });

    const config = mockCreateOpenAI.mock.calls[0][0];
    expect(config.baseURL).toBe('https://custom.gateway.com/ai/api/v2');
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

  it('passes provider fetch options through to createAIGatewayFetch', () => {
    const mockReturn = createMockProvider();
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockReturn);

    createAIGatewayProvider({
      createOpenAI: mockCreateOpenAI as never,
      env: 'production',
      getAuthToken: async () => 'token',
      autoRefreshToken: false,
      tokenCacheTTL: 5000,
      generateRequestId: false,
      normalizeErrors: false,
    });

    const config = mockCreateOpenAI.mock.calls[0][0];
    expect(typeof config.fetch).toBe('function');
  });
});
