import type { ObjectValues } from './util';

export const ImageSize = {
  S256: '256x256',
  S512: '512x512',
  S1024: '1024x1024',
  L1792x1024: '1792x1024',
  L1024x1792: '1024x1792',
} as const;
export type ImageSize = ObjectValues<typeof ImageSize>;

export const ImageQuality = {
  Standard: 'standard',
  HD: 'hd',
} as const;
export type ImageQuality = ObjectValues<typeof ImageQuality>;

export const ImageStyle = {
  Vivid: 'vivid',
  Natural: 'natural',
} as const;
export type ImageStyle = ObjectValues<typeof ImageStyle>;

export const ImageResponseFormat = {
  Url: 'url',
  B64Json: 'b64_json',
} as const;
export type ImageResponseFormat = ObjectValues<typeof ImageResponseFormat>;

/**
 * Request payload for generating images.
 *
 * @example
 * ```ts
 * const request: CreateImageRequest = {
 *   prompt: 'A cat wearing a top hat',
 *   model: 'dall-e-3',
 *   size: ImageSize.S1024,
 *   quality: ImageQuality.HD,
 * };
 * ```
 */
export interface CreateImageRequest {
  /** Text description of the desired image. */
  prompt: string;
  /** Model identifier (e.g. `'dall-e-3'`). */
  model?: string;
  /** Number of images to generate. */
  n?: number;
  /** Image dimensions. */
  size?: ImageSize;
  /** Rendering quality. */
  quality?: ImageQuality;
  /** Response format (URL or base64). */
  response_format?: ImageResponseFormat;
  /** Visual style. */
  style?: ImageStyle;
  [key: string]: unknown;
}

export interface ImageDataItem {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

export interface CreateImageResponse {
  created: number;
  data: ImageDataItem[];
}

export interface CreateImageEditRequest {
  image: Blob | File;
  prompt: string;
  model?: string;
  mask?: Blob | File;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024';
  response_format?: ImageResponseFormat;
}
