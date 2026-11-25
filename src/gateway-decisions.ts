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
  criteria?: unknown;
  /** Any other field, forwarded as sent. */
  [key: string]: unknown;
}

/** An asset referenced by key from `state`, `instructions` or `criteria`. */
export interface DecisionAsset {
  /** e.g. `image`. */
  type: 'image' | (string & {});
  /** Required for images: `png`, `jpg` or `jpeg`. */
  format?: 'png' | 'jpg' | 'jpeg' | (string & {});
  /** Required for images: base64 data without a `data:` prefix. */
  data_base64?: string;
  /** Any other field, forwarded as sent. */
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

/** A `noul` answer. Narrow with `isNoulAnswer()`. */
export interface DecisionNoulAnswer extends DecisionAnswer {
  type: 'noul';
  noul: number;
}

/** A `choice` answer. Narrow with `isChoiceAnswer()`. */
export interface DecisionChoiceAnswer extends DecisionAnswer {
  type: 'choice';
  choice: string;
}

/** A `score` answer. Narrow with `isScoreAnswer()`. */
export interface DecisionScoreAnswer extends DecisionAnswer {
  type: 'score';
  score: number;
}

/** A declined question. Narrow with `isRefusalAnswer()`. */
export interface DecisionRefusalAnswer extends DecisionAnswer {
  type: 'refusal';
}

// The type guards below also check the answer's value, so a malformed answer of a
// known type (e.g. `{ type: 'noul' }`) matches none of them. Use `isRefusalAnswer()`
// to detect refusals rather than a catch-all `else`.

/** `true` for a `noul` answer with a numeric `noul`. */
export function isNoulAnswer(answer: DecisionAnswer | undefined): answer is DecisionNoulAnswer {
  return answer?.type === 'noul' && typeof answer.noul === 'number';
}

/** `true` for a `choice` answer with a string `choice`. */
export function isChoiceAnswer(answer: DecisionAnswer | undefined): answer is DecisionChoiceAnswer {
  return answer?.type === 'choice' && typeof answer.choice === 'string';
}

/** `true` for a `score` answer with a numeric `score`. */
export function isScoreAnswer(answer: DecisionAnswer | undefined): answer is DecisionScoreAnswer {
  return answer?.type === 'score' && typeof answer.score === 'number';
}

/** `true` when the model declined the question. */
export function isRefusalAnswer(answer: DecisionAnswer | undefined): answer is DecisionRefusalAnswer {
  return answer?.type === 'refusal';
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
  /** Keyed by question name; a key may be missing, so check before use. */
  answers: Record<string, DecisionAnswer | undefined>;
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

/** Default timeout (2 minutes): image assets can be large, and an aborted request is still billed. */
export const DEFAULT_DECISIONS_TIMEOUT_MS = 120_000;

/** Public interface returned by `createDecisionClient`. */
export interface DecisionClient {
  /** Ask the model the questions; resolves to its answers. */
  create(request: CreateDecisionRequest, options?: DecisionRequestOptions): Promise<DecisionResponse>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Fail fast on requests the Gateway always rejects, including from untyped callers. */
function assertValidRequest(request: CreateDecisionRequest): void {
  if (!isPlainObject(request)) {
    throw new TypeError('createDecisionClient: request must be an object.');
  }
  const { state, questions } = request;
  if (state === undefined || state === null || state === '') {
    throw new TypeError('createDecisionClient: `state` must not be empty.');
  }
  if (!isPlainObject(questions) || Object.keys(questions).length === 0) {
    throw new TypeError('createDecisionClient: `questions` must have at least one question.');
  }
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
 * if (isNoulAnswer(answers.safe_to_run)) console.log(answers.safe_to_run.noul);
 * ```
 */
export function createDecisionClient(options: GatewayDecisionClientOptions): DecisionClient {
  const resolvedBaseURL = resolveGatewayBaseURL(options.baseURL, options.env, 'createDecisionClient');
  const base = resolvedBaseURL.replace(/\/$/, '');
  const resolvedConfig = resolveConfig({
    ...options,
    baseURL: resolvedBaseURL,
    timeout: options.timeout ?? DEFAULT_DECISIONS_TIMEOUT_MS,
  });
  // No retries: each request is billed. Auth retry on 401 still applies.
  const noRetryConfig = { ...resolvedConfig, retry: false as const };

  const pipelineOptions = {
    includeAuth: true,
    normalizeErrors: true,
    allowAuthRetry: true,
  };

  return {
    async create(request: CreateDecisionRequest, requestOptions?: DecisionRequestOptions): Promise<DecisionResponse> {
      assertValidRequest(request);

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

      let parsed: unknown;
      try {
        parsed = await response.json();
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

      if (!isPlainObject(parsed) || !isPlainObject(parsed.answers)) {
        throw new AIGatewayError(
          `Unexpected decisions response: expected an object with \`answers\` (HTTP ${response.status})`,
          ErrorCode.InternalServerError,
          response.status,
          {},
        );
      }
      return parsed as DecisionResponse;
    },
  };
}
