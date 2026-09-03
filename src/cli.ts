import type { ArgsDef, CommandDef } from 'citty';
import { defineCommand } from 'citty';
import datasourcesListCmd from './commands/datasources/list.js';
import logsQueryCmd from './commands/logs/query.js';
import metricsLabelsCmd from './commands/metrics/labels.js';
import metricsLabelValuesCmd from './commands/metrics/labelValues.js';
import metricsCmd from './commands/metrics/query.js';
import metricsRangeCmd from './commands/metrics/range.js';
import metricsSeriesCmd from './commands/metrics/series.js';
import tracesGetCmd from './commands/traces/get.js';
import tracesServicesCmd from './commands/traces/services.js';
import tracesTraceCmd from './commands/traces/trace.js';
import versionCmd from './commands/version.js';

const metricsGroup = defineCommand({
  meta: { name: 'metrics', description: 'Query Prometheus / VictoriaMetrics' },
  subCommands: {
    query: metricsCmd,
    range: metricsRangeCmd,
    series: metricsSeriesCmd,
    labels: metricsLabelsCmd,
    'label-values': metricsLabelValuesCmd
  }
});

const logsGroup = defineCommand({
  meta: { name: 'logs', description: 'Query LogsQL / VictoriaLogs' },
  subCommands: {
    query: logsQueryCmd
  }
});

const tracesGroup = defineCommand({
  meta: { name: 'traces', description: 'Query Jaeger-compatible traces' },
  subCommands: {
    services: tracesServicesCmd,
    get: tracesGetCmd,
    trace: tracesTraceCmd
  }
});

const datasourcesGroup = defineCommand({
  meta: { name: 'datasources', description: 'Inspect Grafana datasources' },
  subCommands: {
    list: datasourcesListCmd
  }
});

export const cli: CommandDef<ArgsDef> = defineCommand({
  meta: {
    name: 'signalctl',
    description: 'Grafana metrics/logs/traces CLI for AI agents'
  },
  args: {
    server: { type: 'string', description: 'Override GRAFANA_SERVER' },
    token: { type: 'string', description: 'Override GRAFANA_TOKEN' },
    metricsUid: { type: 'string', description: 'Override metrics datasource UID' },
    logsUid: { type: 'string', description: 'Override logs datasource UID' },
    tracesUid: { type: 'string', description: 'Override traces datasource UID' },
    noColor: { type: 'boolean', default: false }
  },
  subCommands: {
    metrics: metricsGroup,
    logs: logsGroup,
    traces: tracesGroup,
    datasources: datasourcesGroup,
    version: versionCmd
  },
  async run({ args }) {
    if (args._?.length === 0) {
      // No subcommand: print help-ish usage
      process.stdout.write(
        'Usage: signalctl <metrics|logs|traces|datasources|version> [subcommand] [...args]\n'
      );
      return;
    }
  }
}) as unknown as CommandDef<ArgsDef>;
