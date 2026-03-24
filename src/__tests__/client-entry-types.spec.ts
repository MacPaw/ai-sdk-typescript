import { describe, it, expect } from 'vitest';
import type {
  Middleware as ClientMiddleware,
  RequestConfig as ClientRequestConfig,
  StreamResponseResult as ClientStreamResponseResult,
  StreamTextResult as ClientStreamTextResult,
} from '../client-entry';
import type { Middleware, RequestConfig } from '../runtime/config';
import type { StreamResponseResult, StreamTextResult } from '../runtime/stream-result';

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
});
