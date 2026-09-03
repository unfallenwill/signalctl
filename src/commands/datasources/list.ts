import { defineCommand } from 'citty';
import { loadConfig } from '../../config.js';
import { grafanaRequest } from '../../http.js';
import { isColorEnabled, writeJson, writeTable } from '../../output.js';
import type { GrafanaDatasourcesResponse } from '../../types.js';

export default defineCommand({
  meta: {
    name: 'list',
    description:
      'List Grafana datasources (UIDs, types, URLs); default JSON output (use --format table for a human view)'
  },
  args: {
    format: {
      type: 'string',
      options: ['json', 'table'],
      default: 'json'
    }
  },
  async run({ args }) {
    const cfg = loadConfig(process.env, {
      server: args.server || undefined,
      token: args.token || undefined
    });
    const list = await grafanaRequest<GrafanaDatasourcesResponse[]>(cfg, {
      extraPath: '/api/datasources'
    });
    const rows = list.map((d) => ({
      id: d.id,
      uid: d.uid,
      name: d.name,
      type: d.type,
      isDefault: d.isDefault ? 'yes' : '',
      url: d.url ?? ''
    }));

    if (args.format === 'json') {
      writeJson(list, { pretty: true });
    } else {
      const colorize = isColorEnabled(args.noColor === true);
      writeTable(
        ['UID', 'NAME', 'TYPE', 'DEFAULT', 'URL'],
        rows.map((r) => [r.uid, r.name, r.type, r.isDefault, r.url]),
        colorize
      );
    }
  }
});
