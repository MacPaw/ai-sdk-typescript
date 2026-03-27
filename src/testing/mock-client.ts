import type { MockStreamTextResult, MockStreamResponseResult } from './mock-streams';
import { createMockFn, type MockFn } from './mock-fn';

// ---------------------------------------------------------------------------
// Mock API shapes — mirrors the real interfaces but with MockFn methods
// ---------------------------------------------------------------------------

export interface MockChatCompletionsAPI {
  create: MockFn;
  stream: MockFn<MockStreamTextResult>;
}

export interface MockResponsesAPI {
  create: MockFn;
  createStream: MockFn;
  stream: MockFn<MockStreamResponseResult>;
}

export interface MockEmbeddingsAPI {
  create: MockFn;
}

export interface MockModelsAPI {
  getInfo: MockFn;
}

export interface MockImagesAPI {
  generate: MockFn;
  edit: MockFn;
}

export interface MockAudioTranscriptionsAPI {
  create: MockFn;
  stream: MockFn<AsyncGenerator<unknown, void, undefined>>;
}

export interface MockAudioTranslationsAPI {
  create: MockFn;
}

export interface MockAudioAPI {
  transcriptions: MockAudioTranscriptionsAPI;
  translations: MockAudioTranslationsAPI;
}

/**
 * A fully-mocked AI Gateway client where every API method is a `MockFn`.
 * It mirrors the real namespace layout for unit tests while keeping the mock API
 * simple and framework-agnostic.
 */
export interface MockAIGatewayClient {
  readonly chat: { completions: MockChatCompletionsAPI };
  readonly responses: MockResponsesAPI;
  readonly embeddings: MockEmbeddingsAPI;
  readonly models: MockModelsAPI;
  readonly images: MockImagesAPI;
  readonly audio: MockAudioAPI;
  use: MockFn<void>;
  /** Reset all mock functions at once. */
  mockResetAll(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fully-mocked `AIGatewayClient` for unit testing.
 *
 * Every API method is a {@link MockFn} with call tracking and
 * `mockReturnValue` / `mockResolvedValue` / `mockImplementation` support.
 *
 * @example
 * ```ts
 * import { createMockAIGatewayClient, createMockStreamTextResult } from '@macpaw/ai-sdk/testing';
 *
 * const client = createMockAIGatewayClient();
 *
 * // Mock a chat completion
 * client.chat.completions.create.mockResolvedValue({
 *   id: 'chatcmpl-1',
 *   object: 'chat.completion',
 *   created: Date.now(),
 *   model: 'gpt-4.1-nano',
 *   choices: [{ index: 0, message: { role: 'assistant', content: 'Hi!' }, finish_reason: 'stop' }],
 * });
 *
 * // Mock streaming
 * client.chat.completions.stream.mockReturnValue(
 *   createMockStreamTextResult({ text: ['Hello', ' world'] }),
 * );
 *
 * // Use in tests
 * const result = await client.chat.completions.create({ ... });
 * expect(client.chat.completions.create.callCount).toBe(1);
 * ```
 */
export function createMockAIGatewayClient(): MockAIGatewayClient {
  const chatCreate = createMockFn();
  const chatStream = createMockFn<MockStreamTextResult>();

  const responsesCreate = createMockFn();
  const responsesCreateStream = createMockFn();
  const responsesStream = createMockFn<MockStreamResponseResult>();

  const embeddingsCreate = createMockFn();
  const modelsGetInfo = createMockFn();
  const imagesGenerate = createMockFn();
  const imagesEdit = createMockFn();

  const audioTranscriptionsCreate = createMockFn();
  const audioTranscriptionsStream = createMockFn<AsyncGenerator<unknown, void, undefined>>();
  const audioTranslationsCreate = createMockFn();

  const use = createMockFn<void>();

  const allMocks = [
    chatCreate,
    chatStream,
    responsesCreate,
    responsesCreateStream,
    responsesStream,
    embeddingsCreate,
    modelsGetInfo,
    imagesGenerate,
    imagesEdit,
    audioTranscriptionsCreate,
    audioTranscriptionsStream,
    audioTranslationsCreate,
    use,
  ];

  const mock: MockAIGatewayClient = {
    chat: {
      completions: { create: chatCreate, stream: chatStream },
    },
    responses: {
      create: responsesCreate,
      createStream: responsesCreateStream,
      stream: responsesStream,
    },
    embeddings: { create: embeddingsCreate },
    models: { getInfo: modelsGetInfo },
    images: { generate: imagesGenerate, edit: imagesEdit },
    audio: {
      transcriptions: { create: audioTranscriptionsCreate, stream: audioTranscriptionsStream },
      translations: { create: audioTranslationsCreate },
    },
    use,
    mockResetAll() {
      for (const m of allMocks) m.mockReset();
    },
  };

  return mock;
}
