/**
 * Video generation client for AI Gateway.
 *
 * Video generation is asynchronous: `createVideo` submits a job and returns a
 * VideoJob with an ID and initial status. Poll `getVideo` until status reaches
 * `'completed'` or `'failed'`, then call `getVideoContent` to retrieve the
 * binary data.
 *
 * Endpoints:
 *   POST   /v1/videos
 *   GET    /v1/videos/:videoId
 *   GET    /v1/videos/:videoId/content
 */

import type { GatewayProviderSettings } from './gateway-config';
import { resolveConfig, resolveGatewayBaseURL } from './gateway-config';
import { executeRequestPipeline } from './gateway-request';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Lifecycle states for an asynchronous video generation job. */
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Request body sent to POST /v1/videos. */
export interface CreateVideoRequest {
  /** ID of the video generation model to use. */
  model: string;
  /** Text description of the video to generate. */
  prompt: string;
  /** Desired video duration in seconds. */
  duration?: number;
  /** Desired resolution, e.g. "1280x720". */
  resolution?: string;
  /** Additional provider-specific parameters. */
  [key: string]: unknown;
}

/** Job record returned by createVideo and getVideo. */
export interface VideoJob {
  /** Unique identifier for the video generation job. */
  id: string;
  /** Current lifecycle status of the job. */
  status: VideoStatus;
  /** ID of the model that was used. */
  model?: string;
  /** Prompt that was submitted. */
  prompt?: string;
  /** ISO-8601 creation timestamp. */
  createdAt?: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt?: string;
  /** URL where the generated video can be accessed, when available. */
  url?: string;
  /** Additional provider-specific fields. */
  [key: string]: unknown;
}

/** Binary video content returned by getVideoContent. */
export interface VideoContent {
  /** Raw video bytes. */
  data: ArrayBuffer;
  /**
   * MIME type of the video, e.g. "video/mp4".
   * Defaults to "video/mp4" when the Content-Type header is absent.
   */
  contentType: string;
}

/**
 * Options for `createVideoClient`.
 * Extends `GatewayProviderSettings` — same surface as `createGatewayProvider`
 * and `createGatewayFetch`.
 */
export interface VideoClientOptions extends GatewayProviderSettings {
  /** Gateway base URL. Required if env is not set. */
  baseURL?: string;
}

/** Video generation client returned by `createVideoClient`. */
export interface VideoClient {
  /**
   * Submit a new video generation job.
   * Returns immediately with a VideoJob whose `status` will be `'pending'` or
   * `'processing'`. Throws `AIGatewayError` on 4xx/5xx responses.
   */
  createVideo(request: CreateVideoRequest): Promise<VideoJob>;
  /**
   * Fetch the current status and metadata for a video job.
   * Poll this until `status` is `'completed'` or `'failed'`.
   * Throws `AIGatewayError` on 4xx/5xx responses.
   */
  getVideo(videoId: string): Promise<VideoJob>;
  /**
   * Fetch the binary content of a completed video job.
   * Returns the raw `ArrayBuffer` and the detected MIME type.
   * Throws `AIGatewayError` on 4xx/5xx responses.
   */
  getVideoContent(videoId: string): Promise<VideoContent>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

const VIDEO_API_VERSION = 'v1';

/**
 * Creates a video generation client backed by AI Gateway.
 *
 * @example
 * ```ts
 * const client = createVideoClient({
 *   baseURL: 'https://api.macpaw.com/ai',
 *   getAuthToken: async () => token,
 * });
 *
 * const job = await client.createVideo({ model: 'kling-1.6-pro', prompt: 'A cat on a skateboard' });
 * // poll until completed
 * const updated = await client.getVideo(job.id);
 * if (updated.status === 'completed') {
 *   const { data, contentType } = await client.getVideoContent(job.id);
 * }
 * ```
 */
export function createVideoClient(options: VideoClientOptions): VideoClient {
  const baseURL = resolveGatewayBaseURL(options.baseURL, options.env, 'createVideoClient');
  const resolvedConfig = resolveConfig({ ...options, baseURL });
  const apiBase = `${baseURL.replace(/\/$/, '')}/${VIDEO_API_VERSION}/videos`;

  async function createVideo(request: CreateVideoRequest): Promise<VideoJob> {
    const response = await executeRequestPipeline(resolvedConfig, {
      url: apiBase,
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.json() as Promise<VideoJob>;
  }

  async function getVideo(videoId: string): Promise<VideoJob> {
    const url = `${apiBase}/${encodeURIComponent(videoId)}`;
    const response = await executeRequestPipeline(resolvedConfig, {
      url,
      method: 'GET',
    });
    return response.json() as Promise<VideoJob>;
  }

  async function getVideoContent(videoId: string): Promise<VideoContent> {
    const url = `${apiBase}/${encodeURIComponent(videoId)}/content`;
    const response = await executeRequestPipeline(resolvedConfig, {
      url,
      method: 'GET',
    });
    const contentType = response.headers.get('Content-Type') ?? 'video/mp4';
    const data = await response.arrayBuffer();
    return { data, contentType };
  }

  return { createVideo, getVideo, getVideoContent };
}
