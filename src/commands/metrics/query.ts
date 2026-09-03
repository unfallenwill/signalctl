import { defineCommand } from 'citty';
import { loadConfig, parseTimeToUnixSeconds } from '../../config.js';
import { flattenVmVector } from '../../format.js';
import { grafanaRequest } from '../../http.js';
import { isColorEnabled, writeJson, writeNdjson, writeTable } from '../../output.js';
import type { VmQueryResponse } from '../../types.js';

export default defineCommand({
  meta: {
    name: 'query',
    description: 'Instant PromQL query against VictoriaMetrics'
  },
  args: {
    query: { type: 'positional', required: true, description: 'PromQL expression' },
    time: { type: 'string', default: 'now', description: 'now | 5m | ISO | unix seconds' },
    format: {
      type: 'string',
      options: ['json', 'ndjson', 'table'],
      default: 'json'
    }
  },
  async run({ args }) {
    const cfg = loadConfig(process.env, {
      server: args.server || undefined,
      token: args.token || undefined,
      metricsUid: args.metricsUid || undefined
    });
    const t = parseTimeToUnixSeconds(args.time);
    const raw = await grafanaRequest<VmQueryResponse>(cfg, {
      proxyUid: cfg.uids.metrics,
      datasourcePath: 'api/v1/query',
      query: { query: args.query, time: t }
    });
    const flat = flattenVmVector(raw);
    emit(flat, args.format, args.noColor === true);
  }
});

function emit(records: ReturnType<typeof flattenVmVector>, format: string, noColor: boolean): void {
  if (format === 'ndjson') {
    writeNdjson(records);
    return;
  }
  if (format === 'table') {
    writeTable(
      ['METRIC', 'TIMESTAMP', 'VALUE'],
      records.map((r) => [JSON.stringify(r.metric), String(r.value[0]), r.value[1]]),
      isColorEnabled(noColor)
    );
    return;
  }
  writeJson(records);
}
