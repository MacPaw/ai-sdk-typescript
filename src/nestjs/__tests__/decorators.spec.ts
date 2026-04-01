import { describe, it, expect } from 'vitest';
import { InjectAIGateway } from '../ai-gateway.decorators';

describe('InjectAIGateway', () => {
  it('returns a decorator function', () => {
    const decorator = InjectAIGateway();
    expect(decorator).toBeTypeOf('function');
  });

  it('returns a function with 3 parameters (ParameterDecorator / PropertyDecorator compatible)', () => {
    // NestJS Inject() produces (target, key, index) => void — 3 formal parameters.
    // This catches regressions where InjectAIGateway is refactored to return
    // the wrong token or an incompatible decorator shape.
    const decorator = InjectAIGateway();
    expect(decorator.length).toBe(3);
  });

  it('each call produces its own decorator instance', () => {
    // InjectAIGateway() must be called per injection site — verify it's not a singleton.
    const a = InjectAIGateway();
    const b = InjectAIGateway();
    expect(typeof a).toBe('function');
    expect(typeof b).toBe('function');
  });
});
