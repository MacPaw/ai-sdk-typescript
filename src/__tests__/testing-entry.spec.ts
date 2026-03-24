import { describe, it, expect } from 'vitest';
import * as testingEntry from '../testing';

describe('testing entry', () => {
  it('exports the intended test helpers without leaking app/runtime APIs', () => {
    expect(testingEntry.createMockOpenAIProvider).toBeDefined();
    expect(testingEntry.createMockAIGatewayClient).toBeDefined();
    expect(testingEntry.createMockTransport).toBeDefined();
    expect(testingEntry.createMockStreamTextResult).toBeDefined();
    expect(testingEntry.createMockStreamResponseResult).toBeDefined();
    expect(testingEntry.createMockChatCompletion).toBeDefined();
    expect(testingEntry.createMockResponseObject).toBeDefined();
    expect(testingEntry.createMockEmbeddingResponse).toBeDefined();
    expect(testingEntry.createMockImageResponse).toBeDefined();
    expect(testingEntry.createMockTranscriptionResponse).toBeDefined();
    expect(testingEntry.createMockTranslationResponse).toBeDefined();
    expect(testingEntry.createMockModelInfoResponse).toBeDefined();
    expect(testingEntry.createMockFn).toBeDefined();

    expect('createAIGatewayClient' in testingEntry).toBe(false);
    expect('createAIGatewayProvider' in testingEntry).toBe(false);
    expect('API_PATHS' in testingEntry).toBe(false);
    expect('generateText' in testingEntry).toBe(false);
  });
});
