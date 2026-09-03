import { describe, expect, it } from 'vitest';
import {
  flattenJaegerServices,
  flattenVlStream,
  flattenVmLabels,
  flattenVmRange,
  flattenVmSeries,
  flattenVmVector,
  summarizeJaegerTraces
} from '../format.js';
import type { JaegerTrace } from '../types.js';

describe('flattenVmVector', () => {
  it('flattens vector result', () => {
    const out = flattenVmVector({
      status: 'success',
      data: {
        resultType: 'vector',
        result: [
          { metric: { job: 'api' }, value: [1700000000, '12'] },
          { metric: { job: 'db' }, value: [1700000001, '3'] }
        ]
      }
    });
    expect(out).toEqual([
      { metric: { job: 'api' }, value: [1700000000, '12'] },
      { metric: { job: 'db' }, value: [1700000001, '3'] }
    ]);
  });
  it('throws on error status', () => {
    expect(() =>
      flattenVmVector({
        status: 'error',
        data: { resultType: 'vector', result: [] },
        error: 'bad query'
      })
    ).toThrow(/bad query/);
  });
});

describe('flattenVmRange', () => {
  it('flattens matrix result', () => {
    const out = flattenVmRange({
      status: 'success',
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { __name__: 'up' },
            values: [
              [1700000000, '1'],
              [1700000030030, '1']
            ]
          }
        ]
      }
    });
    expect(out[0]?.metric.__name__).toBe('up');
    expect(out[0]?.values).toHaveLength(2);
  });
});

describe('flattenVmLabels/Series', () => {
  it('returns label names', () => {
    expect(flattenVmLabels({ status: 'success', data: ['__name__', 'job'] })).toEqual([
      '__name__',
      'job'
    ]);
  });
  it('returns series', () => {
    expect(flattenVmSeries({ status: 'success', data: [{ __name__: 'up', job: 'api' }] })).toEqual([
      { __name__: 'up', job: 'api' }
    ]);
  });
});

describe('flattenVlStream', () => {
  it('parses NDJSON, tolerates blanks and broken lines', () => {
    const ndjson = [
      JSON.stringify({ _time: '2025-01-01T00:00:00Z', _msg: 'hi', _stream: 'svc' }),
      '',
      '{not json',
      JSON.stringify({ _time: '2025-01-01T00:00:01Z', _msg: 'world' })
    ].join('\n');
    const out = flattenVlStream(ndjson);
    expect(out).toHaveLength(2);
    expect(out[0]?._msg).toBe('hi');
    expect(out[1]?._msg).toBe('world');
  });
});

describe('flattenJaegerServices', () => {
  it('returns service list', () => {
    expect(
      flattenJaegerServices({ data: ['a', 'b'], total: 2, limit: 0, offset: 0, errors: null })
    ).toEqual(['a', 'b']);
  });
});

describe('summarizeJaegerTraces', () => {
  const trace: JaegerTrace = {
    traceID: 'abc',
    processes: {
      p1: { serviceName: 'frontend' }
    },
    spans: [
      {
        traceID: 'abc',
        spanID: 's1',
        operationName: 'GET /users',
        references: [],
        startTime: 1700000000000000,
        duration: 1200,
        tags: [{ key: 'otel.status_code', value: 'OK' }],
        processID: 'p1',
        logs: []
      },
      {
        traceID: 'abc',
        spanID: 's2',
        operationName: 'db.query',
        references: [{ refType: 'CHILD_OF', traceID: 'abc', spanID: 's1' }],
        startTime: 1700000000100000,
        duration: 500,
        tags: [{ key: 'otel.status_code', value: 'ERROR' }],
        processID: 'p1',
        logs: []
      }
    ]
  };

  it('picks root span and computes summary', () => {
    const [s] = summarizeJaegerTraces([trace]);
    expect(s?.traceID).toBe('abc');
    expect(s?.spanCount).toBe(2);
    expect(s?.errorCount).toBe(1);
    expect(s?.rootSpan?.operation).toBe('GET /users');
    expect(s?.rootSpan?.duration_us).toBe(1200);
    expect(s?.rootSpan?.status).toBe('ok');
  });

  it('multi-root traces return first root only', () => {
    const dualRoot: JaegerTrace = {
      traceID: 'xyz',
      processes: { p1: { serviceName: 'svc' } },
      spans: [
        {
          traceID: 'xyz',
          spanID: 'r1',
          operationName: 'A',
          references: [],
          startTime: 1,
          duration: 1,
          tags: [],
          processID: 'p1',
          logs: []
        },
        {
          traceID: 'xyz',
          spanID: 'r2',
          operationName: 'B',
          references: [],
          startTime: 1,
          duration: 2,
          tags: [],
          processID: 'p1',
          logs: []
        }
      ]
    };
    const [s] = summarizeJaegerTraces([dualRoot]);
    expect(s?.rootSpan?.operation).toBe('A');
  });

  it('uses error:bool tag for status', () => {
    const t: JaegerTrace = {
      traceID: 't',
      processes: { p1: { serviceName: 'svc' } },
      spans: [
        {
          traceID: 't',
          spanID: 'r',
          operationName: 'X',
          references: [],
          startTime: 1,
          duration: 1,
          tags: [{ key: 'error', value: true }],
          processID: 'p1',
          logs: []
        }
      ]
    };
    const [s] = summarizeJaegerTraces([t]);
    expect(s?.rootSpan?.status).toBe('error');
    expect(s?.errorCount).toBe(1);
  });

  it('returns null rootSpan when no root exists', () => {
    const t: JaegerTrace = {
      traceID: 'orphan',
      processes: { p1: { serviceName: 'svc' } },
      spans: [
        {
          traceID: 'orphan',
          spanID: 'c',
          operationName: 'child',
          references: [{ refType: 'CHILD_OF', traceID: 'other', spanID: 'x' }],
          startTime: 1,
          duration: 1,
          tags: [],
          processID: 'p1',
          logs: []
        }
      ]
    };
    const [s] = summarizeJaegerTraces([t]);
    expect(s?.rootSpan).toBeNull();
  });
});

describe('flattenJaegerServices (defensive)', () => {
  it('throws parse_error on missing data field', () => {
    expect(() => flattenJaegerServices({} as never)).toThrow(/parse_error|unexpected/i);
  });
});
