import { describe, it, expect } from 'vitest';
import * as fromMacpaw from '@macpaw/ai-sdk/anthropic';
import * as fromVercel from '@ai-sdk/anthropic';

describe('@macpaw/ai-sdk/anthropic', () => {
  it('re-exports createAnthropic from @ai-sdk/anthropic', () => {
    const vercelKeys = Object.keys(fromVercel).sort();
    for (const key of vercelKeys) {
      expect(fromMacpaw).toHaveProperty(key);
      expect((fromMacpaw as Record<string, unknown>)[key]).toBe((fromVercel as Record<string, unknown>)[key]);
    }
  });

  it('exports createGatewayAnthropic factory', () => {
    expect(fromMacpaw.createGatewayAnthropic).toBeDefined();
    expect(typeof fromMacpaw.createGatewayAnthropic).toBe('function');
  });
});
