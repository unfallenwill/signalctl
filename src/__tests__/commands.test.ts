import type { ArgsDef, CommandDef } from 'citty';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import datasourcesListCmd from '../commands/datasources/list.js';
import logsQueryCmd from '../commands/logs/query.js';
import metricsLabelsCmd from '../commands/metrics/labels.js';
import metricsLabelValuesCmd from '../commands/metrics/labelValues.js';
import metricsQueryCmd from '../commands/metrics/query.js';
import metricsRangeCmd from '../commands/metrics/range.js';
import metricsSeriesCmd from '../commands/metrics/series.js';
import tracesGetCmd from '../commands/traces/get.js';
import tracesServicesCmd from '../commands/traces/services.js';
import tracesTraceCmd from '../commands/traces/trace.js';
import versionCmd from '../commands/version.js';
import { captured, mockFetch } from './_mockFetch.js';

type RunOfCmd<T extends ArgsDef> = NonNullable<CommandDef<T>['run']>;
type CtxOfCmd<T extends ArgsDef> = Parameters<RunOfCmd<T>>[0];

function stubCtx<T extends ArgsDef>(
  cmd: CommandDef<T>,
  args: Record<string, unknown>
): CtxOfCmd<T> {
  return {
    args: args as CtxOfCmd<T>['args'],
    rawArgs: [],
    cmd: cmd as CtxOfCmd<T>['cmd']
  };
}

function invoke<T extends ArgsDef>(
  cmd: CommandDef<T>,
  args: Record<string, unknown>
): ReturnType<RunOfCmd<T>> {
  const run = cmd.run;
  if (!run) throw new Error('command has no run handler');
  return run(stubCtx(cmd, args));
}

const baseArgs: Record<string, unknown> = {
  server: undefined,
  token: undefined,
  noColor: true
};

beforeEach(() => {
  process.env.GRAFANA_SERVER = 'https://x';
  process.env.GRAFANA_TOKEN = 't';
});

describe('commands/metrics/query', () => {
  it('hits /api/v1/query with PromQL and time', async () => {
    const restore = mockFetch(200, {
      status: 'success',
      data: { resultType: 'vector', result: [{ metric: { job: 'api' }, value: [1, '12'] }] }
    });
    try {
      await invoke(metricsQueryCmd, {
        query: 'up',
        time: 'now',
        format: 'json',
        metricsUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('/api/datasources/proxy/uid/P4169E866C3094E38/api/v1/query');
      expect(captured.url).toContain('query=up');
      expect(captured.headers.authorization).toBe('Bearer t');
    } finally {
      restore();
    }
  });

  it('honors --metricsUid override', async () => {
    const restore = mockFetch(200, {
      status: 'success',
      data: { resultType: 'vector', result: [] }
    });
    try {
      await invoke(metricsQueryCmd, {
        query: 'up',
        time: 'now',
        format: 'json',
        metricsUid: 'custom-uid',
        ...baseArgs
      });
      expect(captured.url).toContain('/proxy/uid/custom-uid/');
    } finally {
      restore();
    }
  });

  it('emits ndjson when --format ndjson', async () => {
    const restore = mockFetch(200, {
      status: 'success',
      data: { resultType: 'vector', result: [{ metric: { job: 'api' }, value: [1, '12'] }] }
    });
    try {
      await invoke(metricsQueryCmd, {
        query: 'up',
        time: 'now',
        format: 'ndjson',
        metricsUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('api/v1/query');
    } finally {
      restore();
    }
  });

  it('emits table when --format table', async () => {
    const restore = mockFetch(200, {
      status: 'success',
      data: { resultType: 'vector', result: [{ metric: { job: 'api' }, value: [1, '12'] }] }
    });
    try {
      await invoke(metricsQueryCmd, {
        query: 'up',
        time: 'now',
        format: 'table',
        metricsUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('api/v1/query');
    } finally {
      restore();
    }
  });
});

describe('commands/metrics/range', () => {
  it('passes start/end/step to query_range', async () => {
    const restore = mockFetch(200, {
      status: 'success',
      data: { resultType: 'matrix', result: [] }
    });
    try {
      await invoke(metricsRangeCmd, {
        query: 'rate(x[5m])',
        start: '1h',
        end: 'now',
        step: '30s',
        format: 'json',
        metricsUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('/api/v1/query_range');
      expect(captured.url).toMatch(/start=\d+/);
      expect(captured.url).toMatch(/step=30/);
    } finally {
      restore();
    }
  });
});

describe('commands/metrics/series', () => {
  it('uses match[] selector', async () => {
    const restore = mockFetch(200, { status: 'success', data: [] });
    try {
      await invoke(metricsSeriesCmd, {
        match: '{job="api"}',
        start: '1h',
        end: 'now',
        limit: '5',
        metricsUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('/api/v1/series');
      expect(captured.url).toContain('match%5B%5D=');
      expect(captured.url).toContain('limit=5');
    } finally {
      restore();
    }
  });
});

describe('commands/metrics/labels', () => {
  it('hits /api/v1/labels', async () => {
    const restore = mockFetch(200, { status: 'success', data: ['__name__', 'job'] });
    try {
      await invoke(metricsLabelsCmd, {
        start: '1h',
        end: 'now',
        metricsUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('/api/v1/labels');
    } finally {
      restore();
    }
  });
});

describe('commands/metrics/label-values', () => {
  it('encodes label name in URL', async () => {
    const restore = mockFetch(200, { status: 'success', data: ['a', 'b'] });
    try {
      await invoke(metricsLabelValuesCmd, {
        name: '__name__',
        start: '1h',
        end: 'now',
        metricsUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('/api/v1/label/__name__/values');
    } finally {
      restore();
    }
  });

  it('throws SignalctlError on upstream error status', async () => {
    const restore = mockFetch(200, { status: 'error', error: 'boom' });
    try {
      await expect(
        invoke(metricsLabelValuesCmd, {
          name: '__name__',
          start: '1h',
          end: 'now',
          metricsUid: undefined,
          ...baseArgs
        })
      ).rejects.toMatchObject({ code: 'server_error', message: 'boom' });
    } finally {
      restore();
    }
  });
});

describe('commands/logs/query', () => {
  it('hits /select/logsql/query with ndjson accept', async () => {
    const restore = mockFetch(
      200,
      '{"_time":"2025-01-01T00:00:00Z","_msg":"hi"}\n',
      'application/x-ndjson'
    );
    try {
      await invoke(logsQueryCmd, {
        query: '*',
        limit: '10',
        start: '1h',
        end: 'now',
        format: 'ndjson',
        logsUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('/select/logsql/query');
      expect(captured.headers.accept).toBe('application/x-ndjson');
      expect(captured.url).toContain('query=*');
    } finally {
      restore();
    }
  });

  it('emits single JSON array when --format json (client-side format param)', async () => {
    const restore = mockFetch(200, '{"_msg":"hi"}\n', 'application/x-ndjson');
    try {
      await invoke(logsQueryCmd, {
        query: '*',
        limit: '10',
        start: '1h',
        end: 'now',
        format: 'json',
        logsUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('limit=10');
      expect(captured.url).not.toContain('format=');
    } finally {
      restore();
    }
  });
});

describe('commands/traces/services', () => {
  it('hits /api/services', async () => {
    const restore = mockFetch(200, { data: ['svc'], total: 1, limit: 0, offset: 0, errors: null });
    try {
      await invoke(tracesServicesCmd, {
        tracesUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('/proxy/uid/P14D5514F5CCC0D1C/api/services');
    } finally {
      restore();
    }
  });
});

describe('commands/traces/get', () => {
  it('defaults to summary path', async () => {
    const restore = mockFetch(200, {
      data: [{ traceID: 't', spans: [], processes: {} }],
      total: 1,
      limit: 1,
      offset: 0
    });
    try {
      await invoke(tracesGetCmd, {
        service: 'svc',
        lookback: '1h',
        limit: '5',
        raw: false,
        tracesUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('/api/traces');
      expect(captured.url).toContain('service=svc');
    } finally {
      restore();
    }
  });
});

describe('commands/traces/trace', () => {
  it('unwraps the jaeger envelope and URL-encodes traceID', async () => {
    const restore = mockFetch(200, {
      data: [{ traceID: 'abc/def==', spans: [], processes: {} }],
      total: 1,
      limit: 1,
      offset: 0
    });
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    try {
      await invoke(tracesTraceCmd, {
        traceID: 'abc/def==',
        tracesUid: undefined,
        ...baseArgs
      });
      expect(captured.url).toContain('/api/traces/abc%2Fdef%3D%3D');
      expect(writes.join('')).toContain('"traceID":"abc/def=="');
    } finally {
      spy.mockRestore();
      restore();
    }
  });
});

describe('commands/datasources/list', () => {
  it('defaults to format=json', async () => {
    const restore = mockFetch(200, []);
    try {
      await invoke(datasourcesListCmd, {
        format: 'json',
        ...baseArgs
      });
      expect(captured.url).toContain('/api/datasources');
    } finally {
      restore();
    }
  });

  it('uses --format table path', async () => {
    const restore = mockFetch(200, [{ id: 1, uid: 'u', name: 'n', type: 't', isDefault: false }]);
    try {
      await invoke(datasourcesListCmd, {
        format: 'table',
        ...baseArgs
      });
      expect(captured.url).toContain('/api/datasources');
    } finally {
      restore();
    }
  });
});

describe('commands/version', () => {
  it('runs without HTTP', async () => {
    await invoke(versionCmd, {});
  });
});
