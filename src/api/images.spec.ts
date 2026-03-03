import { describe, it, expect, vi } from 'vitest';
import { createImage, createImageEdit } from './images';
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

describe('createImage', () => {
  it('sends POST to /api/v1/images/generations and returns typed response', async () => {
    const imageResponse = {
      created: 1700000000,
      data: [{ url: 'https://example.com/image.png', revised_prompt: 'A cat' }],
    };
    const response = new Response(JSON.stringify(imageResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);

    const raw = await createImage(config, { prompt: 'A cat' });
    const result = 'response' in raw ? raw.data : raw;

    expect(result.data).toHaveLength(1);
    expect(result.data[0].url).toBe('https://example.com/image.png');
    expect(result.created).toBe(1700000000);

    const transport = config.transport!;
    const req = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.url).toContain('/api/v1/images/generations');
  });
});

describe('createImageEdit', () => {
  it('sends multipart POST to /api/v1/images/edits', async () => {
    const imageResponse = {
      created: 1700000000,
      data: [{ url: 'https://example.com/edited.png' }],
    };
    const response = new Response(JSON.stringify(imageResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);
    const image = new Blob(['image data'], { type: 'image/png' });

    const raw = await createImageEdit(config, { image, prompt: 'Add sunglasses' });
    const result = 'response' in raw ? raw.data : raw;

    expect(result.data).toHaveLength(1);
    expect(result.data[0].url).toBe('https://example.com/edited.png');

    const transport = config.transport!;
    const req = (transport.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.url).toContain('/api/v1/images/edits');
    expect(req.method).toBe('POST');
    expect(req.body).toBeInstanceOf(FormData);
  });

  it('includes optional fields in FormData', async () => {
    const response = new Response(JSON.stringify({ created: 1, data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const config = createMockConfig(response);
    const image = new Blob(['img'], { type: 'image/png' });
    const mask = new Blob(['mask'], { type: 'image/png' });

    await createImageEdit(config, {
      image,
      prompt: 'Edit',
      model: 'dall-e-2',
      mask,
      n: 2,
      size: '512x512',
      response_format: 'b64_json',
    });

    const req = (config.transport!.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const fd = req.body as FormData;
    expect(fd.get('prompt')).toBe('Edit');
    expect(fd.get('model')).toBe('dall-e-2');
    expect(fd.get('n')).toBe('2');
    expect(fd.get('size')).toBe('512x512');
    expect(fd.get('response_format')).toBe('b64_json');
    expect(fd.get('mask')).toBeTruthy();
  });
});
