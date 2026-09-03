import { defineCommand } from 'citty';
import { loadConfig, parseTimeToUnixSeconds } from '../../config.js';
import { grafanaRequest } from '../../http.js';
import { writeJson } from '../../output.js';
import type { VmLabelsResponse } from '../../types.js';

export default defineCommand({
  meta: {
    name: 'label-values',
    description: 'List values for a label (e.g. label-values __name__ to list metric names)'
  },
  args: {
    name: { type: 'positional', required: true, description: 'Label name' },
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
      datasourcePath: `api/v1/label/${encodeURIComponent(args.name)}/values`,
      query: { start, end }
    });
    if (raw.status !== 'success') {
      writeJson({ error: 'server_error', detail: raw });
      return;
    }
    writeJson(raw.data);
  }
});
