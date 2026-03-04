import { describe, it, expect, vi } from 'vitest';
import { createAIGatewayProvider } from './ai-gateway-provider';

describe('createAIGatewayProvider', () => {
  it('throws when neither baseURL nor env is provided', () => {
    const mockCreateOpenAI = vi.fn();
    expect(() =>
      createAIGatewayProvider({
        createOpenAI: mockCreateOpenAI,
        getAuthToken: async () => 'token',
      }),
    ).toThrow('requires baseURL or env');
  });

  it('calls createOpenAI with correct baseURL from env', () => {
    const mockReturn = Object.assign(
      vi.fn(),
      { chat: vi.fn(), completion: vi.fn(), embedding: vi.fn() },
    );
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockReturn);

    createAIGatewayProvider({
      createOpenAI: mockCreateOpenAI,
      env: 'production',
      getAuthToken: async () => 'token',
    });

    expect(mockCreateOpenAI).toHaveBeenCalledTimes(1);
    const config = mockCreateOpenAI.mock.calls[0][0];
    expect(config.baseURL).toBe('https://api.macpaw.com/ai/api/v1');
    expect(config.apiKey).toBe('unused');
    expect(typeof config.fetch).toBe('function');
  });

  it('uses explicit baseURL over env', () => {
    const mockReturn = Object.assign(
      vi.fn(),
      { chat: vi.fn(), completion: vi.fn(), embedding: vi.fn() },
    );
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockReturn);

    createAIGatewayProvider({
      createOpenAI: mockCreateOpenAI,
      baseURL: 'https://custom.gateway.com/ai',
      getAuthToken: async () => 'token',
    });

    const config = mockCreateOpenAI.mock.calls[0][0];
    expect(config.baseURL).toBe('https://custom.gateway.com/ai/api/v1');
  });

  it('returns the result of createOpenAI', () => {
    const mockReturn = Object.assign(
      vi.fn().mockReturnValue('model-instance'),
      { chat: vi.fn(), completion: vi.fn(), embedding: vi.fn() },
    );
    const mockCreateOpenAI = vi.fn().mockReturnValue(mockReturn);

    const provider = createAIGatewayProvider({
      createOpenAI: mockCreateOpenAI,
      env: 'production',
      getAuthToken: async () => 'token',
    });

    expect(provider).toBe(mockReturn);
    expect(provider('gpt-4')).toBe('model-instance');
  });
});
