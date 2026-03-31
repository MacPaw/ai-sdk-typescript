import { describe, it, expect } from 'vitest';
import { InjectAIGateway } from '../ai-gateway.decorators';

describe('InjectAIGateway', () => {
  it('returns a decorator function', () => {
    const decorator = InjectAIGateway();
    expect(decorator).toBeTypeOf('function');
  });
});
