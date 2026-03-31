/**
 * Convenience helpers for common SDK usage patterns.
 */

import type { ResponseStreamEvent, TranscriptionStreamEvent } from './types';

/**
 * Extract text delta from a Responses API stream event.
 * Returns the delta string or empty string.
 */
export function extractResponseDelta(event: ResponseStreamEvent): string {
  if (event.type === 'response.output_text.delta') {
    return event.delta ?? '';
  }
  return '';
}

/**
 * Collect full text from a Responses API stream.
 */
export async function collectResponseStream(stream: AsyncIterable<ResponseStreamEvent>): Promise<string> {
  let text = '';
  for await (const event of stream) {
    text += extractResponseDelta(event);
  }
  return text;
}

/**
 * Extract text delta from a transcription stream event.
 */
export function extractTranscriptionDelta(event: TranscriptionStreamEvent): string {
  if (event.type === 'transcript.text.delta') {
    return event.delta ?? '';
  }
  return '';
}

/**
 * Collect full text from a transcription stream.
 */
export async function collectTranscriptionStream(stream: AsyncIterable<TranscriptionStreamEvent>): Promise<string> {
  let text = '';
  for await (const event of stream) {
    text += extractTranscriptionDelta(event);
  }
  return text;
}
