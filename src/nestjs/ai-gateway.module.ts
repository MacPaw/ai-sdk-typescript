import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { createAIGatewayClient } from '../client';
import type { AIGatewayClient } from '../client';
import { AI_GATEWAY_CLIENT, AI_GATEWAY_OPTIONS } from './constants';
import type { AIGatewayModuleOptions, AIGatewayModuleAsyncOptions, AIGatewayOptionsFactory } from './interfaces';

@Module({})
export class AIGatewayModule {
  /**
   * Register the module with a static configuration.
   *
   * @example
   * ```ts
   * @Module({
   *   imports: [
   *     AIGatewayModule.forRoot({
   *       env: 'production',
   *       getAuthToken: async () => myTokenService.getToken(),
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static forRoot(options: AIGatewayModuleOptions): DynamicModule {
    const { isGlobal, ...clientConfig } = options;
    const clientProvider: Provider<AIGatewayClient> = {
      provide: AI_GATEWAY_CLIENT,
      useFactory: () => createAIGatewayClient(clientConfig),
    };

    return {
      module: AIGatewayModule,
      global: isGlobal ?? true,
      providers: [clientProvider],
      exports: [clientProvider],
    };
  }

  /**
   * Register the module with async/dynamic configuration.
   * Supports `useFactory`, `useClass`, and `useExisting` patterns.
   *
   * @example
   * ```ts
   * @Module({
   *   imports: [
   *     ConfigModule.forRoot(),
   *     AIGatewayModule.forRootAsync({
   *       imports: [ConfigModule],
   *       useFactory: (configService: ConfigService) => ({
   *         env: configService.get('AI_GATEWAY_ENV'),
   *         getAuthToken: async () => configService.get('AI_GATEWAY_TOKEN'),
   *       }),
   *       inject: [ConfigService],
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static forRootAsync(options: AIGatewayModuleAsyncOptions): DynamicModule {
    const clientProvider: Provider<AIGatewayClient> = {
      provide: AI_GATEWAY_CLIENT,
      useFactory: (moduleOptions: AIGatewayModuleOptions) => createAIGatewayClient(moduleOptions),
      inject: [AI_GATEWAY_OPTIONS],
    };

    const asyncProviders = this.createAsyncProviders(options);

    return {
      module: AIGatewayModule,
      global: options.isGlobal ?? true,
      imports: options.imports ?? [],
      providers: [...asyncProviders, clientProvider],
      exports: [clientProvider],
    };
  }

  private static createAsyncProviders(options: AIGatewayModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: AI_GATEWAY_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }

    const factoryClass = (options.useClass ?? options.useExisting) as Type<AIGatewayOptionsFactory> | undefined;
    if (!factoryClass) {
      throw new Error('AIGatewayModule.forRootAsync() requires useFactory, useClass, or useExisting');
    }

    const providers: Provider[] = [
      {
        provide: AI_GATEWAY_OPTIONS,
        useFactory: (factory: AIGatewayOptionsFactory) => factory.createAIGatewayOptions(),
        inject: [factoryClass],
      },
    ];

    if (options.useClass) {
      providers.push({ provide: factoryClass, useClass: factoryClass });
    }

    return providers;
  }
}
