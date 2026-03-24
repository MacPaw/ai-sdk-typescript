import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import type { AIGatewayClientConfig } from '../runtime/config';

/**
 * Synchronous module configuration.
 * Used with `AIGatewayModule.forRoot(options)`.
 */
export interface AIGatewayModuleOptions extends AIGatewayClientConfig {
  /** Whether the module is global (available without importing in every module). Default: true. */
  isGlobal?: boolean;
}

/**
 * Factory interface for creating options dynamically.
 * Used with `AIGatewayModule.forRootAsync({ useClass: MyFactory })`.
 */
export interface AIGatewayOptionsFactory {
  createAIGatewayOptions(): Promise<AIGatewayModuleOptions> | AIGatewayModuleOptions;
}

/**
 * Async module configuration.
 * Used with `AIGatewayModule.forRootAsync(options)`.
 */
export interface AIGatewayModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /** Existing provider class that implements AIGatewayOptionsFactory. */
  useExisting?: Type<AIGatewayOptionsFactory>;
  /** Class to instantiate as the options factory. */
  useClass?: Type<AIGatewayOptionsFactory>;
  /** Factory function that returns the module options. */
  useFactory?: (...args: unknown[]) => Promise<AIGatewayModuleOptions> | AIGatewayModuleOptions;
  /** Dependencies to inject into useFactory. */
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  /** Whether the module is global (available without importing in every module). Default: true. */
  isGlobal?: boolean;
}
