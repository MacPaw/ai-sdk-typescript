import { describe, it, expect } from 'vitest';
import * as fromMacpaw from '@macpaw/ai-sdk/anthropic';
import * as fromVercel from '@ai-sdk/anthropic';

describe('@macpaw/ai-sdk/anthropic', () => {
  it('re-exports createAnthropic from @ai-sdk/anthropic', () => {
    expect(Object.keys(fromMacpaw).sort()).toEqual(Object.keys(fromVercel).sort());
    expect(fromMacpaw.createAnthropic).toBe(fromVercel.createAnthropic);
  });
});
