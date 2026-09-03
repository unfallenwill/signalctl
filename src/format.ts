import { SignalctlError } from './errors.js';
import type {
  FlatLogRecord,
  FlatMetric,
  FlatRangeSeries,
  JaegerServicesResponse,
  JaegerSpan,
  JaegerTrace,
  TraceSummary,
  VmLabelsResponse,
  VmQueryResponse,
  VmSeriesResponse
} from './types.js';

export function flattenVmVector(raw: VmQueryResponse): FlatMetric[] {
  if (raw.status !== 'success') {
    throw new SignalctlError('server_error', raw.error ?? 'vm query failed', raw);
  }
  if (raw.data.resultType !== 'vector' && raw.data.resultType !== 'scalar') {
    throw new SignalctlError(
      'parse_error',
      `unexpected resultType ${raw.data.resultType} for instant query`,
      raw.data
    );
  }
  const out: FlatMetric[] = [];
  for (const r of raw.data.result) {
    if (r.value) out.push({ metric: r.metric, value: r.value });
  }
  return out;
}

export function flattenVmRange(raw: VmQueryResponse): FlatRangeSeries[] {
  if (raw.status !== 'success') {
    throw new SignalctlError('server_error', raw.error ?? 'vm range query failed', raw);
  }
  if (raw.data.resultType !== 'matrix') {
    throw new SignalctlError(
      'parse_error',
      `unexpected resultType ${raw.data.resultType} for range query`,
      raw.data
    );
  }
  return raw.data.result.map((r) => ({ metric: r.metric, values: r.values ?? [] }));
}

export function flattenVmLabels(raw: VmLabelsResponse): string[] {
  if (raw.status !== 'success') {
    throw new SignalctlError('server_error', raw.error ?? 'vm labels failed', raw);
  }
  return raw.data;
}

export function flattenVmSeries(raw: VmSeriesResponse): Array<Record<string, string>> {
  if (raw.status !== 'success') {
    throw new SignalctlError('server_error', raw.error ?? 'vm series failed', raw);
  }
  return raw.data;
}

export function flattenVlStream(ndjson: string): FlatLogRecord[] {
  const out: FlatLogRecord[] = [];
  for (const line of ndjson.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t) as FlatLogRecord;
      if (obj && typeof obj === 'object') out.push(obj);
    } catch {
      // tolerate broken lines
    }
  }
  return out;
}

export function flattenJaegerServices(raw: JaegerServicesResponse): string[] {
  if (!Array.isArray(raw?.data)) {
    throw new SignalctlError('parse_error', 'unexpected jaeger services response', raw);
  }
  return raw.data;
}

function isRoot(span: JaegerSpan): boolean {
  return !span.references || span.references.length === 0;
}

function startTimeIso(span: JaegerSpan): string {
  // jaeger startTime is microseconds since epoch
  return new Date(Math.floor(span.startTime / 1000)).toISOString();
}

// OTel StatusCode spec: UNSET=0, OK=1, ERROR=2
function findErrorStatus(span: JaegerSpan): 'ok' | 'error' | 'unset' {
  for (const t of span.tags ?? []) {
    if (t.key === 'otel.status_code' || t.key === 'status.code') {
      const v = String(t.value).toLowerCase();
      if (v === '2' || v === 'error') return 'error';
      if (v === '1' || v === 'ok') return 'ok';
      if (v === '0' || v === 'unset') return 'unset';
    }
    if (t.key === 'error' && typeof t.value === 'boolean') {
      return t.value ? 'error' : 'ok';
    }
    if (t.key === 'status' && typeof t.value === 'boolean') {
      return t.value ? 'ok' : 'error';
    }
  }
  return 'unset';
}

export function summarizeJaegerTraces(traces: JaegerTrace[]): TraceSummary[] {
  return traces.map((trace) => {
    const spans = trace.spans ?? [];
    const errorCount = spans.filter((s) => findErrorStatus(s) === 'error').length;
    const rootSpans = spans.filter(isRoot);
    const root = rootSpans[0] ?? null;
    const process = root ? trace.processes?.[root.processID] : undefined;
    return {
      traceID: trace.traceID,
      rootSpan: root
        ? {
            service: process?.serviceName ?? 'unknown',
            operation: root.operationName,
            duration_us: root.duration,
            startTime: startTimeIso(root),
            status: findErrorStatus(root)
          }
        : null,
      spanCount: spans.length,
      errorCount
    };
  });
}

export function flattenJaegerTraces(traces: JaegerTrace[]): JaegerTrace[] {
  return traces;
}
