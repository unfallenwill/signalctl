import { SignalctlError } from './errors.js';

export interface SignalctlConfig {
  server: string;
  token: string;
  uids: {
    metrics: string;
    logs: string;
    traces: string;
  };
  timeoutMs: number;
}

export const DEFAULT_UIDS = {
  metrics: 'P4169E866C3094E38',
  logs: 'PD775F2863313E6C7',
  traces: 'P14D5514F5CCC0D1C'
} as const;

export interface ConfigOverrides {
  server?: unknown;
  token?: unknown;
  metricsUid?: unknown;
  logsUid?: unknown;
  tracesUid?: unknown;
  timeoutMs?: number;
}

function pickString(v: unknown, fallback?: string): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  return fallback;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: ConfigOverrides = {}
): SignalctlConfig {
  const server = (pickString(overrides.server) ?? env.GRAFANA_SERVER ?? '').replace(/\/+$/, '');
  const token = pickString(overrides.token) ?? env.GRAFANA_TOKEN ?? '';
  if (!server) {
    throw new SignalctlError(
      'auth_error',
      'GRAFANA_SERVER is not set (export it or pass --server)'
    );
  }
  if (!token) {
    throw new SignalctlError('auth_error', 'GRAFANA_TOKEN is not set (export it or pass --token)');
  }
  return {
    server,
    token,
    uids: {
      metrics: pickString(overrides.metricsUid) ?? env.GRAFANA_METRICS_UID ?? DEFAULT_UIDS.metrics,
      logs: pickString(overrides.logsUid) ?? env.GRAFANA_LOGS_UID ?? DEFAULT_UIDS.logs,
      traces: pickString(overrides.tracesUid) ?? env.GRAFANA_TRACES_UID ?? DEFAULT_UIDS.traces
    },
    timeoutMs: overrides.timeoutMs ?? 30_000
  };
}

const RELATIVE_RE = /^(-?\d+)\s*(s|m|h|d)$/;

export function parseTimeToUnixSeconds(input: string | undefined, fallback = 'now'): number {
  const v = (input ?? fallback).trim();
  if (!v) {
    throw new SignalctlError('validation_error', 'time value is empty');
  }
  if (v === 'now') return Math.floor(Date.now() / 1000);
  const rel = v.match(RELATIVE_RE);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2];
    const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return Math.floor(Date.now() / 1000) - n * mult;
  }
  if (/^\d{10,13}$/.test(v)) {
    const ms = v.length === 13 ? Number(v) : Number(v) * 1000;
    return Math.floor(ms / 1000);
  }
  const ms = Date.parse(v);
  if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  throw new SignalctlError('validation_error', `unrecognized time value: ${input}`);
}

export function parseDurationSeconds(input: string): number {
  const m = input.trim().match(RELATIVE_RE);
  if (!m) {
    throw new SignalctlError('validation_error', `unrecognized duration: ${input}`);
  }
  const n = Number(m[1]);
  const unit = m[2];
  return unit === 's' ? n : unit === 'm' ? n * 60 : unit === 'h' ? n * 3600 : n * 86400;
}

export function parseDurationString(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  parseDurationSeconds(input);
  return input;
}
