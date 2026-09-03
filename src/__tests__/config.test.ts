import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UIDS,
  loadConfig,
  parseDurationSeconds,
  parseTimeToUnixSeconds
} from '../config.js';
import { SignalctlError } from '../errors.js';

describe('loadConfig', () => {
  it('reads env when no overrides', () => {
    const cfg = loadConfig(
      {
        GRAFANA_SERVER: 'https://grafana.example.com/',
        GRAFANA_TOKEN: 'tok'
      },
      {}
    );
    expect(cfg.server).toBe('https://grafana.example.com');
    expect(cfg.token).toBe('tok');
    expect(cfg.uids).toEqual(DEFAULT_UIDS);
  });

  it('honors overrides', () => {
    const cfg = loadConfig(
      { GRAFANA_SERVER: 'https://x', GRAFANA_TOKEN: 't' },
      { metricsUid: 'm1', logsUid: 'l1', tracesUid: 'r1' }
    );
    expect(cfg.uids.metrics).toBe('m1');
    expect(cfg.uids.logs).toBe('l1');
    expect(cfg.uids.traces).toBe('r1');
  });

  it('throws auth_error when server missing', () => {
    try {
      loadConfig({ GRAFANA_TOKEN: 't' }, {});
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SignalctlError);
      expect((e as SignalctlError).code).toBe('auth_error');
    }
  });

  it('throws auth_error when token missing', () => {
    try {
      loadConfig({ GRAFANA_SERVER: 'https://x' }, {});
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as SignalctlError).code).toBe('auth_error');
    }
  });
});

describe('parseTimeToUnixSeconds', () => {
  it('parses now', () => {
    const r = parseTimeToUnixSeconds('now');
    expect(Math.abs(r - Math.floor(Date.now() / 1000))).toBeLessThanOrEqual(2);
  });
  it('parses relative durations', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(parseTimeToUnixSeconds('5s')).toBeLessThanOrEqual(now - 5);
    expect(parseTimeToUnixSeconds('1m')).toBeLessThanOrEqual(now - 60);
    expect(parseTimeToUnixSeconds('1h')).toBeLessThanOrEqual(now - 3600);
    expect(parseTimeToUnixSeconds('1d')).toBeLessThanOrEqual(now - 86400);
  });
  it('parses unix seconds and millis', () => {
    expect(parseTimeToUnixSeconds('1700000000')).toBe(1700000000);
    expect(parseTimeToUnixSeconds('1700000000000')).toBe(1700000000);
  });
  it('parses ISO 8601', () => {
    expect(parseTimeToUnixSeconds('2024-01-15T00:00:00Z')).toBe(1705276800);
  });
  it('rejects garbage', () => {
    expect(() => parseTimeToUnixSeconds('garbage')).toThrow(SignalctlError);
  });
});

describe('parseDurationSeconds', () => {
  it.each([
    ['30s', 30],
    ['5m', 300],
    ['1h', 3600],
    ['2d', 172800]
  ])('parses %s -> %i', (input, expected) => {
    expect(parseDurationSeconds(input)).toBe(expected);
  });
  it('rejects garbage', () => {
    expect(() => parseDurationSeconds('xx')).toThrow(SignalctlError);
  });
});
