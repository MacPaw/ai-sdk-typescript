/**
 * Client-side request validation.
 * Catches obvious issues before making an HTTP request, providing immediate
 * developer feedback with actionable error messages.
 */

export class SDKValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'SDKValidationError';
    this.field = field;
    Object.setPrototypeOf(this, SDKValidationError.prototype);
  }
}

function requireString(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SDKValidationError(field, `${field} is required and must be a non-empty string`);
  }
}

function requireArray(value: unknown, field: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new SDKValidationError(field, `${field} is required and must be a non-empty array`);
  }
}

function requireBlob(value: unknown, field: string): void {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return;
  if (typeof File !== 'undefined' && value instanceof File) return;
  throw new SDKValidationError(field, `${field} is required and must be a File or Blob`);
}

export function validateChatCompletionRequest(request: { model?: unknown; messages?: unknown }): void {
  requireString(request.model, 'model');
  requireArray(request.messages, 'messages');
}

export function validateResponseRequest(request: { model?: unknown; input?: unknown }): void {
  requireString(request.model, 'model');
  if (request.input == null || (typeof request.input === 'string' && request.input.trim().length === 0)) {
    throw new SDKValidationError('input', 'input is required and must be a non-empty string or array');
  }
}

export function validateEmbeddingRequest(request: { model?: unknown; input?: unknown }): void {
  requireString(request.model, 'model');
  if (request.input == null) {
    throw new SDKValidationError('input', 'input is required');
  }
}

export function validateImageGenerationRequest(request: { prompt?: unknown }): void {
  requireString(request.prompt, 'prompt');
}

export function validateImageEditRequest(request: { image?: unknown; prompt?: unknown }): void {
  requireBlob(request.image, 'image');
  requireString(request.prompt, 'prompt');
}

export function validateTranscriptionRequest(request: { file?: unknown; model?: unknown }): void {
  requireBlob(request.file, 'file');
  requireString(request.model, 'model');
}

export function validateTranslationRequest(request: { file?: unknown; model?: unknown }): void {
  requireBlob(request.file, 'file');
  requireString(request.model, 'model');
}
