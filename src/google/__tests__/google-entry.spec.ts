import { describe, it, expect } from 'vitest';
import * as fromMacpaw from '@macpaw/ai-sdk/google';
import * as fromVercel from '@ai-sdk/google';

describe('@macpaw/ai-sdk/google', () => {
  it('re-exports createGoogleGenerativeAI from @ai-sdk/google', () => {
    expect(Object.keys(fromMacpaw).sort()).toEqual(Object.keys(fromVercel).sort());
    expect(fromMacpaw.createGoogleGenerativeAI).toBe(fromVercel.createGoogleGenerativeAI);
  });
});
