import { describe, it, expect } from 'vitest';
import type { OpenAIProvider } from '@ai-sdk/openai';
import {
  GATEWAY_PROVIDERS,
  createGatewayProvider,
  type GatewayOpenAICompatibleOptions,
  type GatewayProviderOptions,
} from '../index';

type Assert<T extends true> = T;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;

const assertType = <T extends true>(value: T): T => value;

const baseOptions = {
  env: 'production' as const,
  getAuthToken: async () => 'token',
};

describe('createGatewayProvider type surface', () => {
  it('keeps provider-specific option typing aligned', () => {
    const anthropic = createGatewayProvider(GATEWAY_PROVIDERS.ANTHROPIC, baseOptions);
    const fireworks = createGatewayProvider(GATEWAY_PROVIDERS.OPENAI_COMPATIBLE, {
      ...baseOptions,
      modelPrefix: 'fireworks_ai',
    });

    void anthropic;
    void fireworks;

    assertType<Assert<IsEqual<typeof anthropic, OpenAIProvider>>>(true);
    assertType<Assert<IsEqual<typeof fireworks, OpenAIProvider>>>(true);

    type AnthropicOptions = GatewayProviderOptions<typeof GATEWAY_PROVIDERS.ANTHROPIC>;
    type OpenAICompatibleOptions = GatewayProviderOptions<typeof GATEWAY_PROVIDERS.OPENAI_COMPATIBLE>;
    type AnthropicHasOptionalModelPrefix = AnthropicOptions extends { modelPrefix?: string } ? true : false;

    assertType<Assert<AnthropicHasOptionalModelPrefix>>(true);
    assertType<Assert<IsEqual<OpenAICompatibleOptions, GatewayOpenAICompatibleOptions>>>(true);

    // @ts-expect-error openai-compatible requires an explicit modelPrefix
    createGatewayProvider(GATEWAY_PROVIDERS.OPENAI_COMPATIBLE, baseOptions);

    expect(true).toBe(true);
  });
});
