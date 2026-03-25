/**
 * High-level request helper for Gateway API paths.
 * Resolves a relative API path against the configured base URL, then delegates
 * execution to the shared request pipeline.
 */

import type { ResolvedConfig } from './config';
import type { RequestOptions } from '../types';
import { executeRequestPipeline } from './request-executor';

export async function runRequest(
  config: ResolvedConfig,
  path: string,
  init: { method: string; body?: RequestInit['body']; headers?: Record<string, string>; signal?: AbortSignal },
  options?: RequestOptions,
): Promise<Response> {
  const baseURL = config.baseURL.replace(/\/$/, '');
  const url = `${baseURL}${path.startsWith('/') ? path : `/${path}`}`;
  return executeRequestPipeline(
    {
      ...config,
      timeout: options?.timeout ?? config.timeout,
    },
    {
      url,
      method: init.method,
      body: init.body,
      headers: {
        ...init.headers,
        ...options?.headers,
      },
      signal: options?.signal ?? init.signal,
    },
    {
      requestIdPrefix: 'sdk',
    },
  );
}
