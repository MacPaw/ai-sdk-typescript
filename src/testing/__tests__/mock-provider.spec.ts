import { describe, it, expect } from 'vitest';
import { createMockOpenAIProvider } from '../mock-provider';

describe('createMockOpenAIProvider', () => {
  it('returns a callable provider with OpenAI-style methods', () => {
    const provider = createMockOpenAIProvider();
    provider.mockReturnValue({ id: 'mock-model' } as never);
    provider.languageModel.mockReturnValue({ id: 'mock-model' } as never);

    expect(provider('openai/gpt-4.1-nano')).toEqual({ id: 'mock-model' });
    expect(provider.languageModel('openai/gpt-4.1-nano')).toEqual({ id: 'mock-model' });
    expect(typeof provider.chat).toBe('function');
    expect(typeof provider.embedding).toBe('function');
  });

  it('tracks calls across provider methods', () => {
    const provider = createMockOpenAIProvider();

    provider('openai/gpt-4.1-nano');
    provider.chat('openai/gpt-4.1-nano');
    provider.embedding('text-embedding-3-small');

    expect(provider.callCount).toBe(1);
    expect(provider.chat.callCount).toBe(1);
    expect(provider.embedding.callCount).toBe(1);
  });

  it('can reset all mock state at once', () => {
    const provider = createMockOpenAIProvider();
    provider.mockReturnValue('default' as never);

    provider('openai/gpt-4.1-nano');
    provider.languageModel('openai/gpt-4.1-nano');

    provider.mockResetAll();

    expect(provider.callCount).toBe(0);
    expect(provider.languageModel.callCount).toBe(0);
    expect(provider('openai/gpt-4.1-nano')).toBeUndefined();
  });
});
