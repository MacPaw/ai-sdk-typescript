import { describe, it, expect, vi } from 'vitest';
import { createEmbedding } from './embeddings';
import type { ResolvedConfig } from '../core/config';

function createMockConfig(response: Response): ResolvedConfig {
  return {
    baseURL: 'https://api.example.com/ai',
    getAuthToken: vi.fn().mockResolvedValue('token'),
    autoRefreshToken: false,
    tokenCacheTTL: 0,
    transport: { request: vi.fn().mockResolvedValue(response) },
    retry: false,
    middleware: [],
    timeout: 5000,
    logger: {},
    hooks: {},
    generateRequestId: false,
  };
}

describe('createEmbedding', () => {
  it('sends POST to /api/v1/embeddings and returns typed response', async () => {
    const embeddingResponse = {
      object: 'list',
      data: [{ object: 'embedding', embedding: [0.1, 0.2, 0.3], index: 0 }],
      model: 'openai/text-embedding-3-small',
      usage: { prompt_tokens: 5, total_tokens: 5 },
    };
    const response = new Response(JSON.stringify(embeddingResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);

    const raw = await createEmbedding(config, {
      model: 'openai/text-embedding-3-small',
      input: 'Hello world',
    });
    const result = 'response' in raw ? raw.data : raw;

    expect(result.data).toHaveLength(1);
    expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
    expect(result.usage.prompt_tokens).toBe(5);
  });
});
