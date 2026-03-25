import { describe, it, expect } from 'vitest';
import * as runtime from '../index';

describe('runtime entry', () => {
  it('does not expose global transport mutators', () => {
    expect('setDefaultTransport' in runtime).toBe(false);
    expect('resetDefaultTransport' in runtime).toBe(false);
  });
});
