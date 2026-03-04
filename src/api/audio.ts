/**
 * Audio API facade (transcriptions and translations).
 * Uses multipart/form-data for file uploads.
 */

import type { ResolvedConfig } from '../core/config';
import { runRequest } from '../core/request';
import { parseSSEAsJSON } from '../core/sse';
import { validateTranscriptionRequest, validateTranslationRequest } from '../core/validation';
import type {
  CreateTranscriptionRequest,
  TranscriptionResponse,
  TranscriptionStreamEvent,
  CreateTranslationRequest,
  TranslationResponse,
  RequestOptions,
} from '../core/types';

function buildTranscriptionFormData(request: CreateTranscriptionRequest): FormData {
  const formData = new FormData();
  formData.append('file', request.file);
  formData.append('model', request.model);
  if (request.language) formData.append('language', request.language);
  if (request.prompt) formData.append('prompt', request.prompt);
  if (request.response_format) formData.append('response_format', request.response_format);
  if (request.temperature != null) formData.append('temperature', String(request.temperature));
  if (request.timestamp_granularities?.length) {
    for (const g of request.timestamp_granularities) {
      formData.append('timestamp_granularities[]', g);
    }
  }
  if (request.stream != null) formData.append('stream', String(request.stream));
  return formData;
}

export async function createTranscription(
  config: ResolvedConfig,
  request: CreateTranscriptionRequest,
  options?: RequestOptions
): Promise<TranscriptionResponse | { data: TranscriptionResponse; response: Response }> {
  validateTranscriptionRequest(request);
  const formData = buildTranscriptionFormData(request);
  const response = await runRequest(config, config.apiPaths.AudioTranscriptions, { method: 'POST', body: formData }, options);
  const data = (await response.json()) as TranscriptionResponse;
  if (options?.withResponse) return { data, response };
  return data;
}

export async function* createTranscriptionStream(
  config: ResolvedConfig,
  request: CreateTranscriptionRequest,
  options?: RequestOptions
): AsyncGenerator<TranscriptionStreamEvent, void, undefined> {
  validateTranscriptionRequest(request);
  const streamRequest = { ...request, stream: true as const };
  const formData = buildTranscriptionFormData(streamRequest);
  const response = await runRequest(config, config.apiPaths.AudioTranscriptions, { method: 'POST', body: formData }, options);
  const stream = response.body;
  if (!stream) throw new Error('No response body');
  yield* parseSSEAsJSON<TranscriptionStreamEvent>(stream, config.logger);
}

export async function createTranslation(
  config: ResolvedConfig,
  request: CreateTranslationRequest,
  options?: RequestOptions
): Promise<TranslationResponse | { data: TranslationResponse; response: Response }> {
  validateTranslationRequest(request);
  const formData = new FormData();
  formData.append('file', request.file);
  formData.append('model', request.model);
  if (request.prompt) formData.append('prompt', request.prompt);
  if (request.response_format) formData.append('response_format', request.response_format);
  if (request.temperature != null) formData.append('temperature', String(request.temperature));

  const response = await runRequest(config, config.apiPaths.AudioTranslations, { method: 'POST', body: formData }, options);
  const data = (await response.json()) as TranslationResponse;
  if (options?.withResponse) return { data, response };
  return data;
}
