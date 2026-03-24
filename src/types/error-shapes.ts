import type { GatewayApiCode } from './codes';

export interface GatewayApiErrorItem {
  target?: string;
  property?: string;
  constraints?: string[];
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayApiErrorResponse {
  statusCode: number;
  message: string;
  timestamp: string;
  code: GatewayApiCode;
  path?: string;
  errors?: GatewayApiErrorItem[];
  request_id?: string;
}

export interface OpenAIErrorResponse {
  error: {
    message: string;
    type?: string | null;
    code?: string | null;
    param?: string | null;
  };
  request_id?: string;
}
