import { describe, expect, it } from 'vitest';
import { isSignalctlError, SignalctlError } from '../errors.js';

describe('SignalctlError', () => {
  it('serializes to JSON envelope', () => {
    const e = new SignalctlError('auth_error', 'no token', { hint: 'export GRAFANA_TOKEN' });
    expect(e.toJSON()).toEqual({
      error: 'auth_error',
      message: 'no token',
      detail: { hint: 'export GRAFANA_TOKEN' }
    });
  });
  it('omits detail when undefined', () => {
    expect(new SignalctlError('not_found', 'x').toJSON()).toEqual({
      error: 'not_found',
      message: 'x'
    });
  });
  it('isSignalctlError works', () => {
    expect(isSignalctlError(new SignalctlError('auth_error', 'y'))).toBe(true);
    expect(isSignalctlError(new Error('y'))).toBe(false);
    expect(isSignalctlError(null)).toBe(false);
  });
});
