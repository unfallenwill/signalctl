import { defineCommand } from 'citty';
import { loadConfig, parseDurationSeconds, parseTimeToUnixSeconds } from '../../config.js';
import { flattenVmRange } from '../../format.js';
import { grafanaRequest } from '../../http.js';
import { isColorEnabled, writeJson, writeTable } from '../../output.js';
import type { VmQueryResponse } from '../../types.js';

export default defineCommand({
  meta: {
    name: 'range',
    description: 'Range PromQL query against VictoriaMetrics'
  },
  args: {
    query: { type: 'positional', required: true, description: 'PromQL expression' },
    start: { type: 'string', default: '1h' },
    end: { type: 'string', default: 'now' },
    step: { type: 'string', default: '30s' },
    format: {
      type: 'string',
      options: ['json', 'table'],
      default: 'json'
    }
  },
  async run({ args }) {
    const cfg = loadConfig(process.env, {
      server: args.server || undefined,
      token: args.token || undefined,
      metricsUid: args.metricsUid || undefined
    });
    const start = parseTimeToUnixSeconds(args.start);
    const end = parseTimeToUnixSeconds(args.end);
    const step = parseDurationSeconds(args.step);
    const raw = await grafanaRequest<VmQueryResponse>(cfg, {
      proxyUid: cfg.uids.metrics,
      datasourcePath: 'api/v1/query_range',
      query: { query: args.query, start, end, step }
    });
    const flat = flattenVmRange(raw);
    if (args.format === 'table') {
      writeTable(
        ['METRIC', 'POINTS'],
        flat.map((r) => [JSON.stringify(r.metric), String(r.values.length)]),
        isColorEnabled(args.noColor === true)
      );
    } else {
      writeJson(flat);
    }
  }
});
