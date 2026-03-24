import { describe, it, expect, vi } from 'vitest';
import type { DynamicModule } from '@nestjs/common';
import { AIGatewayModule } from '../ai-gateway.module';
import { AI_GATEWAY_CLIENT, AI_GATEWAY_OPTIONS } from '../constants';
import type { AIGatewayClient } from '../../client';

interface ProviderLike {
  provide?: unknown;
  useFactory?: (...args: unknown[]) => unknown;
  inject?: unknown[];
}

function getProviders(moduleDef: DynamicModule): ProviderLike[] {
  return (moduleDef.providers ?? []) as ProviderLike[];
}

function expectProvider(provider: ProviderLike | undefined): ProviderLike {
  expect(provider).toBeDefined();
  return provider as ProviderLike;
}

describe('AIGatewayModule', () => {
  const baseOptions = {
    env: 'production' as const,
    getAuthToken: vi.fn().mockResolvedValue('tok'),
  };

  describe('forRoot', () => {
    it('returns a global DynamicModule with client provider', () => {
      const mod = AIGatewayModule.forRoot(baseOptions);

      expect(mod.module).toBe(AIGatewayModule);
      expect(mod.global).toBe(true);
      expect(mod.providers).toBeDefined();
      expect(mod.exports).toBeDefined();

      const clientProvider = expectProvider(
        getProviders(mod).find((provider) => provider.provide === AI_GATEWAY_CLIENT),
      );
      expect(clientProvider.useFactory).toBeTypeOf('function');
    });

    it('supports isGlobal: false', () => {
      const mod = AIGatewayModule.forRoot({ ...baseOptions, isGlobal: false });
      expect(mod.global).toBe(false);
    });

    it('useFactory creates a working client', () => {
      const mod = AIGatewayModule.forRoot(baseOptions);
      const clientProvider = expectProvider(
        getProviders(mod).find((provider) => provider.provide === AI_GATEWAY_CLIENT),
      );

      const client = clientProvider.useFactory?.() as AIGatewayClient;
      expect(client).toBeDefined();
      expect(client.chat).toBeDefined();
      expect(client.responses).toBeDefined();
      expect(client.embeddings).toBeDefined();
      expect(client.models).toBeDefined();
      expect(client.images).toBeDefined();
      expect(client.audio).toBeDefined();
    });
  });

  describe('forRootAsync', () => {
    it('returns a DynamicModule with factory provider', () => {
      const mod = AIGatewayModule.forRootAsync({
        useFactory: () => baseOptions,
      });

      expect(mod.module).toBe(AIGatewayModule);
      expect(mod.global).toBe(true);

      const optionsProvider = expectProvider(
        getProviders(mod).find((provider) => provider.provide === AI_GATEWAY_OPTIONS),
      );
      expect(optionsProvider.useFactory).toBeTypeOf('function');

      const clientProvider = expectProvider(
        getProviders(mod).find((provider) => provider.provide === AI_GATEWAY_CLIENT),
      );
      expect(clientProvider.inject).toContain(AI_GATEWAY_OPTIONS);
    });

    it('supports isGlobal: false', () => {
      const mod = AIGatewayModule.forRootAsync({
        useFactory: () => baseOptions,
        isGlobal: false,
      });
      expect(mod.global).toBe(false);
    });

    it('supports useClass pattern', () => {
      class TestFactory {
        createAIGatewayOptions() {
          return baseOptions;
        }
      }

      const mod = AIGatewayModule.forRootAsync({
        useClass: TestFactory,
      });

      const providers = getProviders(mod);
      const factoryProvider = providers.find((provider) => provider.provide === TestFactory);
      expect(factoryProvider).toBeDefined();
    });

    it('supports useExisting pattern', () => {
      class ExistingFactory {
        createAIGatewayOptions() {
          return baseOptions;
        }
      }

      const mod = AIGatewayModule.forRootAsync({
        useExisting: ExistingFactory,
      });

      const providers = getProviders(mod);
      const optionsProvider = expectProvider(providers.find((provider) => provider.provide === AI_GATEWAY_OPTIONS));
      expect(optionsProvider.inject).toContain(ExistingFactory);

      const classProvider = providers.find((provider) => provider.provide === ExistingFactory);
      expect(classProvider).toBeUndefined();
    });

    it('throws when no provider strategy specified', () => {
      expect(() => AIGatewayModule.forRootAsync({})).toThrow('requires useFactory, useClass, or useExisting');
    });
  });
});
