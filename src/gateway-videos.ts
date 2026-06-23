/**
 * Video generation client for the AI Gateway SDK.
 *
 * Wraps three Gateway endpoints:
 *   POST   /ai/v1/videos                         — create a video job
 *   GET    /ai/v1/videos/{video_id}               — poll job status + metadata
 *   GET    /ai/v1/videos/{video_id}/content       — fetch binary content
 *
 * Internally reuses the shared `executeRequestPipeline` + `resolveConfig`
 * primitives — the same approach taken by `gateway-fetch.ts`.
 */

import type { GatewayProviderSettings } from './gateway-config';
import { resolveConfig, resolveGatewayBaseURL } from './gateway-config';
import { AIGatewayError, ErrorCode } from './gateway-errors';
import { executeRequestPipeline } from './gateway-request';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VideoJobStatus = 'queued' | 'processing' | 'in_progress' | 'completed' | 'failed';

export type VideoContentVariant = 'video' | 'thumbnail' | 'spritesheet';

export interface VideoJobError {
  /** gRPC-style numeric code (Google Veo) or a string code (OpenAI). */
  code?: number | string | null;
  message?: string;
}

export interface VideoJob {
  /** Unique job identifier. */
  id: string;
  /** Object type, e.g. `"video.generation.job"`. */
  object: string;
  /** Current status of the video job. */
  status: VideoJobStatus;
  /** Model used to generate the video (e.g. `"veo-2"`). */
  model?: string | null;
  /** Generation progress 0–100. */
  progress?: number | null;
  /** Unix timestamp when the job was created. */
  created_at?: number | null;
  /** Unix timestamp when the job completed. */
  completed_at?: number | null;
  /** Unix timestamp when the job assets expire. */
  expires_at?: number | null;
  /** The prompt used for generation. */
  prompt?: string | null;
  /** Requested duration in seconds (as a string, e.g. `"5"`). */
  seconds?: string | null;
  /** Requested resolution / aspect ratio (e.g. `"1280x720"`). */
  size?: string | null;
  /** Error details when `status === 'failed'`. */
  error?: VideoJobError | null;
  /** Source video ID when this is a remix. */
  remixed_from_video_id?: string | null;
  /** Token usage metadata (provider-dependent). */
  usage?: Record<string, unknown> | null;
}

export interface VideoCreateRequest {
  /** Model identifier (e.g. `"veo-2"`). */
  model: string;
  /** Text prompt describing the video to generate. */
  prompt: string;
  /** Optional input image/video reference for image-to-video or remix flows. */
  input_reference?: {
    /** File ID of a previously uploaded image. */
    file_id?: string;
    /** Publicly accessible image URL. */
    image_url?: string;
  };
  /** Desired duration in seconds (as a string, e.g. `"5"`). */
  seconds?: string;
  /** Desired resolution / aspect ratio (e.g. `"1280x720"`). */
  size?: string;
}

/**
 * Options for `createVideoClient`.
 * Accepts either `baseURL` or `env: 'production'` — the same convention used by
 * `createGatewayProvider` and `createAIGatewayProvider`.
 */
export interface GatewayVideoClientOptions extends GatewayProviderSettings {}

/** Public interface returned by `createVideoClient`. */
export interface VideoClient {
  /** Submit a new video generation job. Returns the initial `VideoJob` object. */
  create(request: VideoCreateRequest): Promise<VideoJob>;
  /** Poll a video job by ID to get its current status and metadata. */
  get(videoId: string): Promise<VideoJob>;
  /**
   * Fetch binary video content (or a thumbnail / spritesheet) for a completed job.
   * Returns the raw `Response` so callers can consume `.arrayBuffer()`, `.blob()`,
   * or `.body` as a stream — the Content-Type is provider-dependent.
   */
  getContent(videoId: string, variant?: VideoContentVariant): Promise<Response>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a `VideoClient` that talks to the AI Gateway video endpoints.
 *
 * @example
 * ```ts
 * // With an explicit URL:
 * const videos = createVideoClient({
 *   baseURL: 'https://api.macpaw.com/ai',
 *   getAuthToken: () => Promise.resolve(myJwt),
 * });
 *
 * // Or using the production environment shorthand:
 * const videos = createVideoClient({
 *   env: 'production',
 *   getAuthToken: () => Promise.resolve(myJwt),
 * });
 *
 * const job = await videos.create({ model: 'veo-2', prompt: 'A sunset over the ocean' });
 * ```
 */
export function createVideoClient(options: GatewayVideoClientOptions): VideoClient {
  const resolvedBaseURL = resolveGatewayBaseURL(options.baseURL, options.env, 'createVideoClient');
  const base = resolvedBaseURL.replace(/\/$/, '');
  const resolvedConfig = resolveConfig({ ...options, baseURL: resolvedBaseURL });
  // POST create() is non-idempotent: retrying on 5xx risks duplicate video-generation jobs.
  // Auth retry (401 → fresh token) is still handled at the behavior level.
  const noRetryConfig = { ...resolvedConfig, retry: false as const };

  const pipelineOptions = {
    includeAuth: true,
    normalizeErrors: true,
    allowAuthRetry: true,
  };

  return {
    async create(request: VideoCreateRequest): Promise<VideoJob> {
      const response = await executeRequestPipeline(
        noRetryConfig,
        {
          url: `${base}/v1/videos`,
          method: 'POST',
          body: JSON.stringify(request),
        },
        pipelineOptions,
      );
      try {
        return (await response.json()) as VideoJob;
      } catch (err) {
        throw new AIGatewayError(
          'Failed to parse video creation response as JSON',
          ErrorCode.InternalServerError,
          response.status,
          {},
          { cause: err },
        );
      }
    },

    async get(videoId: string): Promise<VideoJob> {
      const id = encodeURIComponent(videoId);
      const response = await executeRequestPipeline(
        resolvedConfig,
        {
          url: `${base}/v1/videos/${id}`,
          method: 'GET',
        },
        pipelineOptions,
      );
      try {
        return (await response.json()) as VideoJob;
      } catch (err) {
        throw new AIGatewayError(
          'Failed to parse video job response as JSON',
          ErrorCode.InternalServerError,
          response.status,
          {},
          { cause: err },
        );
      }
    },

    async getContent(videoId: string, variant?: VideoContentVariant): Promise<Response> {
      const id = encodeURIComponent(videoId);
      const url = variant
        ? `${base}/v1/videos/${id}/content?variant=${encodeURIComponent(variant)}`
        : `${base}/v1/videos/${id}/content`;

      return executeRequestPipeline(
        resolvedConfig,
        {
          url,
          method: 'GET',
        },
        pipelineOptions,
      );
    },
  };
}
