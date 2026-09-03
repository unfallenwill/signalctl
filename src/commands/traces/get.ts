import { defineCommand } from 'citty';
import { loadConfig } from '../../config.js';
import { flattenJaegerTraces, summarizeJaegerTraces } from '../../format.js';
import { grafanaRequest } from '../../http.js';
import { writeJson } from '../../output.js';
import type { JaegerTracesResponse } from '../../types.js';

export default defineCommand({
  meta: {
    name: 'get',
    description:
      'Fetch traces for a service; default output is a summary (use --raw for full Jaeger JSON)'
  },
  args: {
    service: { type: 'positional', required: true },
    lookback: { type: 'string', default: '1h' },
    limit: { type: 'string', default: '20' },
    raw: { type: 'boolean', default: false }
  },
  async run({ args }) {
    const cfg = loadConfig(process.env, {
      server: args.server || undefined,
      token: args.token || undefined,
      tracesUid: args.tracesUid || undefined
    });
    const raw = await grafanaRequest<JaegerTracesResponse>(cfg, {
      proxyUid: cfg.uids.traces,
      datasourcePath: 'api/traces',
      query: { service: args.service, lookback: args.lookback, limit: Number(args.limit) }
    });
    if (args.raw) {
      writeJson(flattenJaegerTraces(raw.data ?? []));
    } else {
      writeJson(summarizeJaegerTraces(raw.data ?? []));
    }
  }
});
