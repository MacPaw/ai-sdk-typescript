import { describe, it, expect } from 'vitest';
import { GATEWAY_PLACEHOLDER_API_KEY, normalizeBearerToken } from '../gateway-fetch';

describe('normalizeBearerToken', () => {
  it('returns null for null/undefined/empty', () => {
    expect(normalizeBearerToken(null)).toBeNull();
    expect(normalizeBearerToken(undefined)).toBeNull();
    expect(normalizeBearerToken('')).toBeNull();
    expect(normalizeBearerToken('  ')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(normalizeBearerToken('  abc  ')).toBe('abc');
  });

  it('strips surrounding quotes', () => {
    expect(normalizeBearerToken('"my-token"')).toBe('my-token');
    expect(normalizeBearerToken("'jwt'")).toBe('jwt');
  });

  it('strips trailing comma and semicolon (.env noise)', () => {
    expect(normalizeBearerToken('eyJ.x.y,')).toBe('eyJ.x.y');
    expect(normalizeBearerToken('eyJ.x.y;;')).toBe('eyJ.x.y');
    expect(normalizeBearerToken('tok,  ')).toBe('tok');
  });
});

describe('GATEWAY_PLACEHOLDER_API_KEY', () => {
  it('is stable', () => {
    expect(GATEWAY_PLACEHOLDER_API_KEY).toBe('ai-gateway-auth-via-fetch');
  });
});
