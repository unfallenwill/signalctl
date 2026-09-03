import { defineCommand } from 'citty';
import { loadConfig } from '../../config.js';
import { flattenJaegerServices } from '../../format.js';
import { grafanaRequest } from '../../http.js';
import { writeJson } from '../../output.js';
import type { JaegerServicesResponse } from '../../types.js';

export default defineCommand({
  meta: {
    name: 'services',
    description: 'List trace services'
  },
  async run({ args }) {
    const cfg = loadConfig(process.env, {
      server: args.server || undefined,
      token: args.token || undefined,
      tracesUid: args.tracesUid || undefined
    });
    const raw = await grafanaRequest<JaegerServicesResponse>(cfg, {
      proxyUid: cfg.uids.traces,
      datasourcePath: 'api/services'
    });
    writeJson(flattenJaegerServices(raw));
  }
});
