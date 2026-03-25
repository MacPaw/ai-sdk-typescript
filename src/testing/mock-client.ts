import type { MockStreamTextResult, MockStreamResponseResult } from './mock-streams';
import { createMockFn, type MockFn } from './mock-fn';

// ---------------------------------------------------------------------------
// Mock API shapes — mirrors the real interfaces but with MockFn methods
// ---------------------------------------------------------------------------

export interface MockChatCompletionsAPI {
  create: MockFn;
  createWithResponse: MockFn;
  stream: MockFn<MockStreamTextResult>;
}

export interface MockResponsesAPI {
  create: MockFn;
  createWithResponse: MockFn;
  createStream: MockFn;
  stream: MockFn<MockStreamResponseResult>;
}

export interface MockEmbeddingsAPI {
  create: MockFn;
  createWithResponse: MockFn;
}

export interface MockModelsAPI {
  getInfo: MockFn;
  getInfoWithResponse: MockFn;
}

export interface MockImagesAPI {
  generate: MockFn;
  generateWithResponse: MockFn;
  edit: MockFn;
  editWithResponse: MockFn;
}

export interface MockAudioTranscriptionsAPI {
  create: MockFn;
  createWithResponse: MockFn;
}

export interface MockAudioTranslationsAPI {
  create: MockFn;
  createWithResponse: MockFn;
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
  const chatCreateWithResponse = createMockFn();
  const chatStream = createMockFn<MockStreamTextResult>();

  const responsesCreate = createMockFn();
  const responsesCreateWithResponse = createMockFn();
  const responsesCreateStream = createMockFn();
  const responsesStream = createMockFn<MockStreamResponseResult>();

  const embeddingsCreate = createMockFn();
  const embeddingsCreateWithResponse = createMockFn();
  const modelsGetInfo = createMockFn();
  const modelsGetInfoWithResponse = createMockFn();
  const imagesGenerate = createMockFn();
  const imagesGenerateWithResponse = createMockFn();
  const imagesEdit = createMockFn();
  const imagesEditWithResponse = createMockFn();

  const audioTranscriptionsCreate = createMockFn();
  const audioTranscriptionsCreateWithResponse = createMockFn();
  const audioTranslationsCreate = createMockFn();
  const audioTranslationsCreateWithResponse = createMockFn();

  const use = createMockFn<void>();

  const allMocks = [
    chatCreate,
    chatCreateWithResponse,
    chatStream,
    responsesCreate,
    responsesCreateWithResponse,
    responsesCreateStream,
    responsesStream,
    embeddingsCreate,
    embeddingsCreateWithResponse,
    modelsGetInfo,
    modelsGetInfoWithResponse,
    imagesGenerate,
    imagesGenerateWithResponse,
    imagesEdit,
    imagesEditWithResponse,
    audioTranscriptionsCreate,
    audioTranscriptionsCreateWithResponse,
    audioTranslationsCreate,
    audioTranslationsCreateWithResponse,
    use,
  ];

  const mock: MockAIGatewayClient = {
    chat: {
      completions: { create: chatCreate, createWithResponse: chatCreateWithResponse, stream: chatStream },
    },
    responses: {
      create: responsesCreate,
      createWithResponse: responsesCreateWithResponse,
      createStream: responsesCreateStream,
      stream: responsesStream,
    },
    embeddings: { create: embeddingsCreate, createWithResponse: embeddingsCreateWithResponse },
    models: { getInfo: modelsGetInfo, getInfoWithResponse: modelsGetInfoWithResponse },
    images: {
      generate: imagesGenerate,
      generateWithResponse: imagesGenerateWithResponse,
      edit: imagesEdit,
      editWithResponse: imagesEditWithResponse,
    },
    audio: {
      transcriptions: { create: audioTranscriptionsCreate, createWithResponse: audioTranscriptionsCreateWithResponse },
      translations: { create: audioTranslationsCreate, createWithResponse: audioTranslationsCreateWithResponse },
    },
    use,
    mockResetAll() {
      for (const m of allMocks) m.mockReset();
    },
  };

  return mock;
}
