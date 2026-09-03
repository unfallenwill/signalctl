import { defineCommand } from 'citty';
import { loadConfig, parseTimeToUnixSeconds } from '../../config.js';
import { flattenVmSeries } from '../../format.js';
import { grafanaRequest } from '../../http.js';
import { writeJson } from '../../output.js';
import type { VmSeriesResponse } from '../../types.js';

export default defineCommand({
  meta: {
    name: 'series',
    description: 'List matching time series (PromQL series selector)'
  },
  args: {
    match: { type: 'positional', required: true, description: 'PromQL series selector' },
    start: { type: 'string', default: '1h' },
    end: { type: 'string', default: 'now' },
    limit: { type: 'string', default: '1000' }
  },
  async run({ args }) {
    const cfg = loadConfig(process.env, {
      server: args.server || undefined,
      token: args.token || undefined,
      metricsUid: args.metricsUid || undefined
    });
    const start = parseTimeToUnixSeconds(args.start);
    const end = parseTimeToUnixSeconds(args.end);
    const raw = await grafanaRequest<VmSeriesResponse>(cfg, {
      proxyUid: cfg.uids.metrics,
      datasourcePath: 'api/v1/series',
      query: {
        'match[]': args.match,
        start,
        end,
        limit: Number(args.limit)
      }
    });
    writeJson(flattenVmSeries(raw));
  }
});
