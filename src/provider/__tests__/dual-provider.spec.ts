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
    providerLabel: `${label}-provider`,
    experimentalHelper: vi.fn().mockReturnValue(`${label}-experimental`),
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

  it('resolves providers lazily and only when selected', () => {
    const gateway = createMockProvider('gateway');
    const direct = createMockProvider('direct');
    const gatewayFactory = vi.fn().mockReturnValue(gateway);
    const directFactory = vi.fn().mockReturnValue(direct);

    const provider = createAIGatewayDualProvider({
      useGateway: false,
      gateway: gatewayFactory,
      direct: directFactory,
    });

    expect(gatewayFactory).not.toHaveBeenCalled();
    expect(directFactory).not.toHaveBeenCalled();

    expect(provider('openai/gpt-4.1-nano')).toBe('direct-call');
    expect(directFactory).toHaveBeenCalledTimes(1);
    expect(gatewayFactory).not.toHaveBeenCalled();

    expect(provider.chat('openai/gpt-4.1-nano')).toBe('direct-chat');
    expect(directFactory).toHaveBeenCalledTimes(1);
  });

  it('forwards provider properties without a manual allowlist', () => {
    const gateway = createMockProvider('gateway') as OpenAIProvider & {
      providerLabel: string;
      experimentalHelper: () => string;
    };
    const direct = createMockProvider('direct') as OpenAIProvider & {
      providerLabel: string;
      experimentalHelper: () => string;
    };
    let useGateway = false;

    const provider = createAIGatewayDualProvider({
      useGateway: () => useGateway,
      gateway,
      direct,
    }) as OpenAIProvider & {
      providerLabel: string;
      experimentalHelper: () => string;
    };

    expect(provider.providerLabel).toBe('direct-provider');
    expect(provider.experimentalHelper()).toBe('direct-experimental');

    useGateway = true;

    expect(provider.providerLabel).toBe('gateway-provider');
    expect(provider.experimentalHelper()).toBe('gateway-experimental');
  });

  it('forwards proxy meta operations to the selected provider', () => {
    const gateway = createMockProvider('gateway') as OpenAIProvider & Record<string | symbol, unknown>;
    const direct = createMockProvider('direct') as OpenAIProvider & Record<string | symbol, unknown>;
    let useGateway = false;

    const provider = createAIGatewayDualProvider({
      useGateway: () => useGateway,
      gateway,
      direct,
    }) as OpenAIProvider & Record<string | symbol, unknown>;

    expect('providerLabel' in provider).toBe(true);
    expect(Reflect.ownKeys(provider)).toContain('providerLabel');
    expect(Object.getOwnPropertyDescriptor(provider, 'providerLabel')?.value).toBe('direct-provider');

    Object.defineProperty(provider, 'runtimeFlag', {
      value: 'direct-runtime',
      configurable: true,
      enumerable: true,
      writable: true,
    });
    expect(direct.runtimeFlag).toBe('direct-runtime');

    provider.runtimeFlag = 'direct-runtime-updated';
    expect(direct.runtimeFlag).toBe('direct-runtime-updated');

    expect(delete provider.runtimeFlag).toBe(true);
    expect('runtimeFlag' in direct).toBe(false);

    useGateway = true;

    Object.defineProperty(provider, 'runtimeFlag', {
      value: 'gateway-runtime',
      configurable: true,
      enumerable: true,
      writable: true,
    });
    expect(gateway.runtimeFlag).toBe('gateway-runtime');
    expect(Object.getOwnPropertyDescriptor(provider, 'providerLabel')?.value).toBe('gateway-provider');
  });
});
