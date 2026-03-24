import type { ObjectValues } from './util';

export const AudioFormat = {
  Json: 'json',
  Text: 'text',
  Srt: 'srt',
  VerboseJson: 'verbose_json',
  Vtt: 'vtt',
  DiarizedJson: 'diarized_json',
} as const;
export type AudioFormat = ObjectValues<typeof AudioFormat>;

export const TranslationFormat = {
  Json: 'json',
  Text: 'text',
  Srt: 'srt',
  VerboseJson: 'verbose_json',
  Vtt: 'vtt',
} as const;
export type TranslationFormat = ObjectValues<typeof TranslationFormat>;

export interface CreateTranscriptionRequest {
  file: Blob | File;
  model: string;
  language?: string;
  prompt?: string;
  response_format?: AudioFormat;
  temperature?: number;
  timestamp_granularities?: Array<'word' | 'segment'>;
  stream?: boolean;
}

export interface TranscriptionResponse {
  text: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  duration?: number;
  language?: string;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens?: number[];
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
}

export interface TranscriptionStreamEvent {
  type: 'transcript.text.delta' | 'transcript.text.done';
  delta?: string;
  text?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface CreateTranslationRequest {
  file: Blob | File;
  model: string;
  prompt?: string;
  response_format?: TranslationFormat;
  temperature?: number;
}

export interface TranslationResponse {
  text: string;
  duration?: number;
  language?: string;
  segments?: TranscriptionSegment[];
}
