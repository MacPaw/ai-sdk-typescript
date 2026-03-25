import { describe, it, expect } from 'vitest';
import * as fromMacpaw from '@macpaw/ai-sdk/google';
import * as fromVercel from '@ai-sdk/google';

describe('@macpaw/ai-sdk/google', () => {
  it('re-exports createGoogleGenerativeAI from @ai-sdk/google', () => {
    const vercelKeys = Object.keys(fromVercel).sort();
    for (const key of vercelKeys) {
      expect(fromMacpaw).toHaveProperty(key);
      expect((fromMacpaw as Record<string, unknown>)[key]).toBe((fromVercel as Record<string, unknown>)[key]);
    }
  });

  it('exports createGatewayGoogle factory', () => {
    expect(fromMacpaw.createGatewayGoogle).toBeDefined();
    expect(typeof fromMacpaw.createGatewayGoogle).toBe('function');
  });
});
