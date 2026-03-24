import { describe, it, expect } from 'vitest';
import * as fromMacpawReact from '@macpaw/ai-sdk/react';
import * as fromVercelReact from '@ai-sdk/react';

describe('@macpaw/ai-sdk/react', () => {
  it('re-exports the same hooks as @ai-sdk/react', () => {
    expect(Object.keys(fromMacpawReact).sort()).toEqual(Object.keys(fromVercelReact).sort());
    expect(fromMacpawReact.useChat).toBe(fromVercelReact.useChat);
    expect(fromMacpawReact.useCompletion).toBe(fromVercelReact.useCompletion);
  });
});
