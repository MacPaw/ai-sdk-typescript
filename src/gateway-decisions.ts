/**
 * Decisions client: `POST /ai/v1/decisions`.
 *
 * Asks a decision model typed questions about a `state` and returns typed answers.
 * Only the Gateway contract is typed; any other field is forwarded as sent.
 */

import type { GatewayProviderSettings } from './gateway-config';
import { resolveConfig, resolveGatewayBaseURL } from './gateway-config';
import { AIGatewayError, ErrorCode } from './gateway-errors';
import { executeRequestPipeline } from './gateway-request';

// ─── Types ────────────────────────────────────────────────────────────────────

/** `noul` (yes/no), `choice` (one option) or `score` (position on a scale). */
export type DecisionQuestionType = 'noul' | 'choice' | 'score' | (string & {});

/** A question about `state`; its answer comes back under the same key. */
export interface DecisionQuestion {
  type: DecisionQuestionType;
  /** Optional guidance, as text or JSON. */
  instructions?: unknown;
  /**
   * `noul`: `{ true, false }`. `choice`: option name → guidance.
   * `score`: an ordered array, lowest first.
   */
  criteria?: Record<string, unknown> | unknown[];
  /** Any other field, forwarded as sent. */
  [key: string]: unknown;
}

/** An image referenced by key from `state`, `instructions` or `criteria`. */
export interface DecisionAsset {
  type: 'image' | (string & {});
  format: 'png' | 'jpg' | 'jpeg' | (string & {});
  /** Base64 data without a `data:` prefix. */
  data_base64: string;
  [key: string]: unknown;
}

/** Request body for `DecisionClient.create()`. */
export interface CreateDecisionRequest {
  /** `provider/model`, e.g. `"typesafe/jev-1.13"`. */
  model: string;
  /** What the model reasons over: non-empty text, a JSON object, or text and `image_url` parts. */
  state: string | Record<string, unknown> | unknown[];
  /** At least one question, keyed by name. */
  questions: Record<string, DecisionQuestion>;
  /** Every asset must be referenced at least once. */
  assets?: Record<string, DecisionAsset>;
  session_id?: string;
  user?: string;
  /** Any other field, forwarded as sent. Names are not checked by the compiler — use the Gateway's. */
  [key: string]: unknown;
}

/** `refusal` when the model declined the question; the other answers are still returned. */
export type DecisionAnswerType = 'noul' | 'choice' | 'score' | 'refusal' | (string & {});

/** One answer, keyed by question name in `DecisionResponse.answers`. */
export interface DecisionAnswer {
  type: DecisionAnswerType;
  /** `noul`: probability of yes, 0–1. */
  noul?: number;
  /** `choice`: the picked option. */
  choice?: string;
  /** `score`: probability-weighted position on the scale. */
  score?: number;
  /** Per option (`choice`) or per level (`score`). */
  probabilities?: Record<string, number>;
  /** `score`: level labels. */
  legend?: Record<string, string>;
  confidence?: number;
  [key: string]: unknown;
}

export interface DecisionUsage {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number; [key: string]: unknown };
  [key: string]: unknown;
}

/** Response of `DecisionClient.create()`. */
export interface DecisionResponse {
  id: string;
  /** Versioned id of the model that answered. */
  model: string;
  provider?: string;
  answers: Record<string, DecisionAnswer>;
  annotations?: Record<string, unknown>[];
  usage: DecisionUsage;
  [key: string]: unknown;
}

/** Options for `createDecisionClient`. */
export type GatewayDecisionClientOptions = GatewayProviderSettings;

/** Per-call options for `DecisionClient.create()`. */
export interface DecisionRequestOptions {
  /** Cancels the request when aborted. */
  signal?: AbortSignal;
}

/** Public interface returned by `createDecisionClient`. */
export interface DecisionClient {
  /** Ask the model the questions; resolves to its answers. */
  create(request: CreateDecisionRequest, options?: DecisionRequestOptions): Promise<DecisionResponse>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a `DecisionClient`.
 *
 * @example
 * ```ts
 * const decisions = createDecisionClient({ env: 'production', getAuthToken: () => Promise.resolve(myJwt) });
 * const { answers } = await decisions.create({
 *   model: 'typesafe/jev-1.13',
 *   state: { tool: 'shell', command: 'rm -rf ~/Library/Caches/com.example.app' },
 *   questions: { safe_to_run: { type: 'noul', criteria: { true: 'Only removes caches.', false: 'Deletes user data.' } } },
 * });
 * ```
 */
export function createDecisionClient(options: GatewayDecisionClientOptions): DecisionClient {
  const resolvedBaseURL = resolveGatewayBaseURL(options.baseURL, options.env, 'createDecisionClient');
  const base = resolvedBaseURL.replace(/\/$/, '');
  const resolvedConfig = resolveConfig({ ...options, baseURL: resolvedBaseURL });
  // No retries: each request is billed. Auth retry on 401 still applies.
  const noRetryConfig = { ...resolvedConfig, retry: false as const };

  const pipelineOptions = {
    includeAuth: true,
    normalizeErrors: true,
    allowAuthRetry: true,
  };

  return {
    async create(request: CreateDecisionRequest, requestOptions?: DecisionRequestOptions): Promise<DecisionResponse> {
      let body: string;
      try {
        body = JSON.stringify(request);
      } catch (err) {
        // e.g. a BigInt or a circular object in `state`.
        throw new TypeError('createDecisionClient: request cannot be JSON-encoded.', { cause: err });
      }

      const response = await executeRequestPipeline(
        noRetryConfig,
        {
          url: `${base}/v1/decisions`,
          method: 'POST',
          body,
          signal: requestOptions?.signal,
        },
        pipelineOptions,
      );

      try {
        return (await response.json()) as DecisionResponse;
      } catch (err) {
        throw new AIGatewayError(
          `Failed to parse decisions response as JSON (HTTP ${response.status}, ` +
            `content-type: ${response.headers.get('content-type') ?? 'none'})`,
          ErrorCode.InternalServerError,
          response.status,
          {},
          { cause: err },
        );
      }
    },
  };
}
