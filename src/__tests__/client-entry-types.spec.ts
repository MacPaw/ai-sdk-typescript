import { describe, it, expect } from 'vitest';
import { createAIGatewayClient } from '../client';
import type {
  Middleware as ClientMiddleware,
  RequestConfig as ClientRequestConfig,
  StreamResponseResult as ClientStreamResponseResult,
  StreamTextResult as ClientStreamTextResult,
} from '../client-entry';
import type { Middleware, RequestConfig } from '../runtime/config';
import type { StreamResponseResult, StreamTextResult } from '../runtime/stream-result';
import type { ModelInfoResponse, WithResponseResult } from '../types';

type Assert<T extends true> = T;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? ((<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false)
    : false;

const assertType = <T extends true>(value: T): T => value;

describe('client entry type exports', () => {
  it('compiles with the runtime companion types re-exported from the client entry', () => {
    assertType<Assert<IsEqual<ClientMiddleware, Middleware>>>(true);
    assertType<Assert<IsEqual<ClientRequestConfig, RequestConfig>>>(true);
    assertType<Assert<IsEqual<ClientStreamTextResult, StreamTextResult>>>(true);
    assertType<Assert<IsEqual<ClientStreamResponseResult, StreamResponseResult>>>(true);
    expect(true).toBe(true);
  });

  it('keeps models.getInfo overloads aligned with runtime behavior', () => {
    const client = createAIGatewayClient({
      baseURL: 'https://api.example.com/ai',
      getAuthToken: async () => 'token',
    });

    const result = client.models.getInfo();
    const resultWithResponse = client.models.getInfo(undefined, { withResponse: true });

    assertType<Assert<IsEqual<Awaited<typeof result>, ModelInfoResponse>>>(true);
    assertType<Assert<IsEqual<Awaited<typeof resultWithResponse>, WithResponseResult<ModelInfoResponse>>>>(true);
    expect(true).toBe(true);
  });
});
