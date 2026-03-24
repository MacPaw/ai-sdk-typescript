import { describe, it, expect } from 'vitest';
import * as fromUpstreamAi from 'ai';
import * as fromAiPath from '@macpaw/ai-sdk/ai';
import * as fromProvider from '../index';

describe('@macpaw/ai-sdk/ai subpath', () => {
  it('contains the full upstream `ai` export surface', () => {
    const upstreamKeys = Object.keys(fromUpstreamAi).sort();
    const providerKeys = Object.keys(fromProvider).sort();
    const missingKeys = upstreamKeys.filter((key) => !providerKeys.includes(key));

    expect(missingKeys).toEqual([]);
  });

  it('matches the provider entry surface for core `ai` + gateway helpers', () => {
    expect(Object.keys(fromAiPath).sort()).toEqual(Object.keys(fromProvider).sort());
    expect(fromAiPath.generateText).toBe(fromProvider.generateText);
    expect(fromAiPath.createAIGatewayProvider).toBe(fromProvider.createAIGatewayProvider);
    expect(fromAiPath.ErrorCode).toBe(fromProvider.ErrorCode);
  });

  it('keeps upstream references for tool, object, and UI stream helpers', () => {
    expect(fromAiPath.tool).toBe(fromUpstreamAi.tool);
    expect(fromAiPath.generateObject).toBe(fromUpstreamAi.generateObject);
    expect(fromAiPath.streamObject).toBe(fromUpstreamAi.streamObject);
    expect(fromAiPath.createUIMessageStream).toBe(fromUpstreamAi.createUIMessageStream);
  });
});

describe('@macpaw/ai-sdk/ai/internal and /test', () => {
  it('re-exports `ai/internal`', async () => {
    // Dynamic imports do not use Vitest `resolve.alias`; keep parity with published paths via relative shim.
    const shim = await import('../../ai-internal');
    const direct = await import('ai/internal');
    expect(Object.keys(shim).sort()).toEqual(Object.keys(direct).sort());
    expect(shim.convertAsyncIteratorToReadableStream).toBe(direct.convertAsyncIteratorToReadableStream);
  });

  it('re-exports `ai/test`', async () => {
    const shim = await import('../../ai-test');
    const direct = await import('ai/test');
    expect(Object.keys(shim).sort()).toEqual(Object.keys(direct).sort());
  });
});
