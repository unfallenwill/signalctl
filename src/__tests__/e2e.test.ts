import { describe, expect, it } from 'vitest';

describe.skipIf(!process.env.INTEGRATION)('e2e (live Grafana)', () => {
  it('vm label-values returns array of metric names', async () => {
    const env = process.env;
    if (!env.GRAFANA_SERVER || !env.GRAFANA_TOKEN) return;
    const { loadConfig } = await import('../config.js');
    const { grafanaRequest } = await import('../http.js');
    const cfg = loadConfig(env);
    const raw = await grafanaRequest<{ status: 'success' | 'error'; data: string[] }>(cfg, {
      proxyUid: cfg.uids.metrics,
      datasourcePath: 'api/v1/label/__name__/values',
      query: { start: Math.floor(Date.now() / 1000) - 86400, end: Math.floor(Date.now() / 1000) }
    });
    expect(raw.status).toBe('success');
    expect(Array.isArray(raw.data)).toBe(true);
  });

  it('jaeger services returns non-empty list', async () => {
    const env = process.env;
    if (!env.GRAFANA_SERVER || !env.GRAFANA_TOKEN) return;
    const { loadConfig } = await import('../config.js');
    const { grafanaRequest } = await import('../http.js');
    const { flattenJaegerServices } = await import('../format.js');
    const cfg = loadConfig(env);
    const raw = await grafanaRequest<{
      data: string[];
      total: number;
      limit: number;
      offset: number;
      errors: unknown;
    }>(cfg, {
      proxyUid: cfg.uids.traces,
      datasourcePath: 'api/services'
    });
    const services = flattenJaegerServices(raw);
    expect(services.length).toBeGreaterThan(0);
  });

  it('vl ndjson query returns records', async () => {
    const env = process.env;
    if (!env.GRAFANA_SERVER || !env.GRAFANA_TOKEN) return;
    const { loadConfig } = await import('../config.js');
    const { grafanaRequestText } = await import('../http.js');
    const { flattenVlStream } = await import('../format.js');
    const cfg = loadConfig(env);
    const text = await grafanaRequestText(cfg, {
      proxyUid: cfg.uids.logs,
      datasourcePath: 'select/logsql/query',
      query: { query: '*', limit: 3 },
      accept: 'application/x-ndjson'
    });
    const records = flattenVlStream(text);
    expect(records.length).toBeGreaterThan(0);
    expect(records[0]).toHaveProperty('_msg');
  });
});
