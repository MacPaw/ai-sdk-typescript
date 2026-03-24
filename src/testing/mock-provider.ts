import type { OpenAIProvider } from '@ai-sdk/openai';
import { createMockFn } from './mock-fn';
import type { MockFn } from './mock-fn';

type MockProviderMethod<T extends (...args: never[]) => unknown> = T & MockFn<ReturnType<T>>;

export type MockOpenAIProvider = OpenAIProvider &
  MockFn<ReturnType<OpenAIProvider>> & {
    languageModel: MockProviderMethod<OpenAIProvider['languageModel']>;
    chat: MockProviderMethod<OpenAIProvider['chat']>;
    responses: MockProviderMethod<OpenAIProvider['responses']>;
    completion: MockProviderMethod<OpenAIProvider['completion']>;
    embedding: MockProviderMethod<OpenAIProvider['embedding']>;
    embeddingModel: MockProviderMethod<OpenAIProvider['embeddingModel']>;
    textEmbedding: MockProviderMethod<OpenAIProvider['textEmbedding']>;
    textEmbeddingModel: MockProviderMethod<OpenAIProvider['textEmbeddingModel']>;
    image: MockProviderMethod<OpenAIProvider['image']>;
    imageModel: MockProviderMethod<OpenAIProvider['imageModel']>;
    transcription: MockProviderMethod<OpenAIProvider['transcription']>;
    speech: MockProviderMethod<OpenAIProvider['speech']>;
    mockResetAll(): void;
  };

/**
 * Create a mock OpenAI-compatible provider for testing Vercel AI SDK integrations.
 *
 * This is useful when your application is built around `generateText`, `streamText`,
 * or a provider-selection layer and you want call tracking without a real network.
 */
export function createMockOpenAIProvider(): MockOpenAIProvider {
  const call = createMockFn<ReturnType<OpenAIProvider>>();
  const languageModel = createMockFn<ReturnType<OpenAIProvider['languageModel']>>();
  const chat = createMockFn<ReturnType<OpenAIProvider['chat']>>();
  const responses = createMockFn<ReturnType<OpenAIProvider['responses']>>();
  const completion = createMockFn<ReturnType<OpenAIProvider['completion']>>();
  const embedding = createMockFn<ReturnType<OpenAIProvider['embedding']>>();
  const embeddingModel = createMockFn<ReturnType<OpenAIProvider['embeddingModel']>>();
  const textEmbedding = createMockFn<ReturnType<OpenAIProvider['textEmbedding']>>();
  const textEmbeddingModel = createMockFn<ReturnType<OpenAIProvider['textEmbeddingModel']>>();
  const image = createMockFn<ReturnType<OpenAIProvider['image']>>();
  const imageModel = createMockFn<ReturnType<OpenAIProvider['imageModel']>>();
  const transcription = createMockFn<ReturnType<OpenAIProvider['transcription']>>();
  const speech = createMockFn<ReturnType<OpenAIProvider['speech']>>();

  const provider = Object.assign(call, {
    languageModel,
    chat,
    responses,
    completion,
    embedding,
    embeddingModel,
    textEmbedding,
    textEmbeddingModel,
    image,
    imageModel,
    transcription,
    speech,
    tools: {},
    mockResetAll() {
      call.mockReset();
      languageModel.mockReset();
      chat.mockReset();
      responses.mockReset();
      completion.mockReset();
      embedding.mockReset();
      embeddingModel.mockReset();
      textEmbedding.mockReset();
      textEmbeddingModel.mockReset();
      image.mockReset();
      imageModel.mockReset();
      transcription.mockReset();
      speech.mockReset();
    },
  }) as unknown as MockOpenAIProvider;

  return provider;
}
