import { defineCommand } from 'citty';
import { loadConfig } from '../../config.js';
import { grafanaRequest } from '../../http.js';
import { writeJson } from '../../output.js';
import type { JaegerTracesResponse } from '../../types.js';

export default defineCommand({
  meta: {
    name: 'trace',
    description: 'Fetch a single trace by ID (full Jaeger JSON)'
  },
  args: {
    traceID: { type: 'positional', required: true }
  },
  async run({ args }) {
    const cfg = loadConfig(process.env, {
      server: args.server || undefined,
      token: args.token || undefined,
      tracesUid: args.tracesUid || undefined
    });
    const raw = await grafanaRequest<JaegerTracesResponse>(cfg, {
      proxyUid: cfg.uids.traces,
      datasourcePath: `api/traces/${encodeURIComponent(args.traceID)}`
    });
    writeJson(raw.data ?? []);
  }
});
