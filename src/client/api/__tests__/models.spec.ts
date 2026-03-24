import { describe, it, expect, vi } from 'vitest';
import { getModelInfo } from '../models';
import type { ResolvedConfig } from '../../../core/config';
import { API_PATHS } from '../../../core/paths';
import { SDKValidationError } from '../../../runtime/validation';

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
    apiPaths: API_PATHS,
  };
}

describe('getModelInfo', () => {
  it('sends GET to /api/v1/model/info', async () => {
    const modelResponse = {
      data: [
        {
          model_name: 'openai/gpt-4.1-nano',
          model_info: {
            id: 'openai/gpt-4.1-nano',
            supports_vision: true,
            supports_function_calling: true,
            supports_native_streaming: true,
          },
        },
      ],
    };
    const response = new Response(JSON.stringify(modelResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);

    const raw = await getModelInfo(config);
    const result = 'response' in raw ? raw.data : raw;

    expect(result.data).toHaveLength(1);
    expect(result.data[0].model_name).toBe('openai/gpt-4.1-nano');

    const transport = config.transport!;
    const req = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.url).toContain('/api/v1/model/info');
    expect(req.method).toBe('GET');
  });

  it('appends query parameter when litellm_model_id is provided', async () => {
    const response = new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);

    await getModelInfo(config, { litellm_model_id: 'openai/gpt-4.1-nano' });

    const transport = config.transport!;
    const req = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.url).toContain('litellm_model_id=openai%2Fgpt-4.1-nano');
  });

  it('validates litellm_model_id when provided', async () => {
    const response = new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);

    await expect(getModelInfo(config, { litellm_model_id: '   ' })).rejects.toBeInstanceOf(SDKValidationError);
  });
});
