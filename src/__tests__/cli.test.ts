import type { ArgsDef, CommandDef, SubCommandsDef } from 'citty';
import { describe, expect, it } from 'vitest';
import { cli } from '../cli.js';

const cliTyped: CommandDef<ArgsDef> = cli;
const argsDef = cliTyped.args as ArgsDef | undefined;
const subsDef = cliTyped.subCommands as SubCommandsDef | undefined;

describe('cli', () => {
  it('exposes 5 top-level subcommands', () => {
    if (!subsDef) throw new Error('no subCommands');
    expect(Object.keys(subsDef).sort()).toEqual([
      'datasources',
      'logs',
      'metrics',
      'traces',
      'version'
    ]);
  });

  it('has global flag overrides for credentials', () => {
    if (!argsDef) throw new Error('no args');
    expect(argsDef['server']?.type).toBe('string');
    expect(argsDef['token']?.type).toBe('string');
    expect(argsDef['noColor']?.type).toBe('boolean');
  });

  it('metrics group exposes 5 sub-commands', () => {
    if (!subsDef) throw new Error('no subCommands');
    const metrics = subsDef['metrics'] as CommandDef<ArgsDef> | undefined;
    if (!metrics) throw new Error('no metrics');
    const mSubs = metrics.subCommands as SubCommandsDef | undefined;
    if (!mSubs) throw new Error('metrics has no subCommands');
    expect(Object.keys(mSubs).sort()).toEqual([
      'label-values',
      'labels',
      'query',
      'range',
      'series'
    ]);
  });

  it('logs/traces/datasources groups expose expected sub-commands', () => {
    if (!subsDef) throw new Error('no subCommands');
    const logs = subsDef['logs'] as CommandDef<ArgsDef> | undefined;
    const traces = subsDef['traces'] as CommandDef<ArgsDef> | undefined;
    const datas = subsDef['datasources'] as CommandDef<ArgsDef> | undefined;
    if (!logs?.subCommands) throw new Error('no logs');
    if (!traces?.subCommands) throw new Error('no traces');
    if (!datas?.subCommands) throw new Error('no datasources');
    const logsSubs = logs.subCommands as SubCommandsDef;
    const tracesSubs = traces.subCommands as SubCommandsDef;
    const datasSubs = datas.subCommands as SubCommandsDef;
    expect(Object.keys(logsSubs)).toEqual(['query']);
    expect(Object.keys(tracesSubs).sort()).toEqual(['get', 'services', 'trace']);
    expect(Object.keys(datasSubs)).toEqual(['list']);
  });
});
