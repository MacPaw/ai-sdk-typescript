import { describe, it, expect } from 'vitest';
import {
  SDKValidationError,
  validateChatCompletionRequest,
  validateResponseRequest,
  validateEmbeddingRequest,
  validateImageGenerationRequest,
} from '../validation';

describe('validateChatCompletionRequest', () => {
  it('passes with valid request', () => {
    expect(() =>
      validateChatCompletionRequest({
        model: 'openai/gpt-4.1-nano',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).not.toThrow();
  });

  it('throws on missing model', () => {
    expect(() =>
      validateChatCompletionRequest({
        model: '',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).toThrow(SDKValidationError);
  });

  it('throws on missing messages', () => {
    expect(() =>
      validateChatCompletionRequest({
        model: 'openai/gpt-4.1-nano',
        messages: [],
      }),
    ).toThrow(SDKValidationError);
  });

  it('error has field property', () => {
    try {
      validateChatCompletionRequest({ model: '', messages: [] });
    } catch (e) {
      expect((e as SDKValidationError).field).toBe('model');
    }
  });
});

describe('validateResponseRequest', () => {
  it('passes with valid string input', () => {
    expect(() => validateResponseRequest({ model: 'm', input: 'hello' })).not.toThrow();
  });

  it('throws on empty input string', () => {
    expect(() => validateResponseRequest({ model: 'm', input: '' })).toThrow(SDKValidationError);
  });

  it('throws on null input', () => {
    expect(() => validateResponseRequest({ model: 'm', input: null })).toThrow(SDKValidationError);
  });

  it('throws on empty array input', () => {
    expect(() => validateResponseRequest({ model: 'm', input: [] })).toThrow(SDKValidationError);
  });

  it('passes with non-empty array input', () => {
    expect(() => validateResponseRequest({ model: 'm', input: [{ role: 'user', content: 'hi' }] })).not.toThrow();
  });
});

describe('validateEmbeddingRequest', () => {
  it('passes with valid request', () => {
    expect(() => validateEmbeddingRequest({ model: 'm', input: 'text' })).not.toThrow();
  });

  it('throws on missing input', () => {
    expect(() => validateEmbeddingRequest({ model: 'm', input: undefined })).toThrow(SDKValidationError);
  });
});

describe('validateImageGenerationRequest', () => {
  it('passes with valid prompt', () => {
    expect(() => validateImageGenerationRequest({ prompt: 'a cat' })).not.toThrow();
  });

  it('throws on empty prompt', () => {
    expect(() => validateImageGenerationRequest({ prompt: '' })).toThrow(SDKValidationError);
  });
});
