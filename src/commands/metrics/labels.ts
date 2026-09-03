import { defineCommand } from 'citty';
import { loadConfig, parseTimeToUnixSeconds } from '../../config.js';
import { flattenVmLabels } from '../../format.js';
import { grafanaRequest } from '../../http.js';
import { writeJson } from '../../output.js';
import type { VmLabelsResponse } from '../../types.js';

export default defineCommand({
  meta: {
    name: 'labels',
    description: 'List label names present in the time range'
  },
  args: {
    start: { type: 'string', default: '1h' },
    end: { type: 'string', default: 'now' }
  },
  async run({ args }) {
    const cfg = loadConfig(process.env, {
      server: args.server || undefined,
      token: args.token || undefined,
      metricsUid: args.metricsUid || undefined
    });
    const start = parseTimeToUnixSeconds(args.start);
    const end = parseTimeToUnixSeconds(args.end);
    const raw = await grafanaRequest<VmLabelsResponse>(cfg, {
      proxyUid: cfg.uids.metrics,
      datasourcePath: 'api/v1/labels',
      query: { start, end }
    });
    writeJson(flattenVmLabels(raw));
  }
});
