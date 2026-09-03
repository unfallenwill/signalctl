#!/usr/bin/env node
import type { ArgsDef, CommandDef, Resolvable } from 'citty';
import { renderUsage, runCommand } from 'citty';
import { cli } from './cli.js';
import { isSignalctlError } from './errors.js';
import { commandPath, getDoc } from './help.js';

async function resolveValue<T>(value: Resolvable<T>): Promise<T> {
  return typeof value === 'function' ? await (value as () => T | Promise<T>)() : value;
}

function emitError(e: unknown): void {
  let payload: { error: string; message: string };
  if (isSignalctlError(e)) {
    const env = e.toJSON();
    payload = { error: env.error, message: env.message };
  } else {
    const err = e as { message?: string } | null;
    payload = { error: 'internal_error', message: err?.message ?? String(e) };
  }
  process.stderr.write(`${JSON.stringify(payload)}\n`);
}

async function resolveSubCommand(
  cmd: CommandDef<ArgsDef>,
  argv: string[],
  trail: string[] = []
): Promise<{ cmd: CommandDef<ArgsDef>; parent: CommandDef<ArgsDef> | null; path: string[] }> {
  const subsResolvable = cmd.subCommands;
  if (subsResolvable === undefined) return { cmd, parent: null, path: trail };
  const subs = (await resolveValue(subsResolvable)) as Record<
    string,
    Resolvable<CommandDef<ArgsDef>>
  >;
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === undefined) break;
    if (a === '--help' || a === '-h') {
      i += 1;
      continue;
    }
    if (a.startsWith('--')) {
      i += 1;
      const next = argv[i];
      if (next !== undefined && !next.startsWith('-')) i += 1;
      continue;
    }
    if (a.startsWith('-') && a.length > 1) {
      i += 1;
      continue;
    }
    break;
  }
  const subName = argv[i];
  if (subName === undefined || !(subName in subs)) return { cmd, parent: null, path: trail };
  const resolved = subs[subName];
  const resolvedCmd = (await resolveValue(resolved)) as CommandDef<ArgsDef>;
  return resolveSubCommand(resolvedCmd, argv.slice(i + 1), [...trail, subName]).then((r) => ({
    cmd: r.cmd,
    parent: r.parent ?? cmd,
    path: r.path
  }));
}

function appendDocSection(usage: string, path: string[]): string {
  const doc = getDoc(commandPath(path));
  if (!doc) return usage;
  const out: string[] = [usage];
  if (doc.example) {
    out.push('', 'EXAMPLE', `  ${doc.example.replace(/\n/g, '\n  ')}`);
  }
  if (doc.returns) {
    out.push('', 'RETURNS', `  ${doc.returns.type}: ${doc.returns.fields}`);
  }
  if (doc.notes) {
    out.push('', 'NOTES', `  ${doc.notes}`);
  }
  out.push('');
  return out.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    const path = argv.filter((a) => a !== '--help' && a !== '-h');
    const { cmd, parent, path: cmdPath } = await resolveSubCommand(cli, path);
    const usage = await renderUsage(cmd, parent ?? undefined);
    process.stdout.write(`${appendDocSection(usage, cmdPath)}\n`);
    return;
  }
  try {
    await runCommand(cli, { rawArgs: argv });
  } catch (e) {
    emitError(e);
    process.exit(1);
  }
}

process.on('uncaughtException', (e) => {
  emitError(e);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  emitError(e);
  process.exit(1);
});

main();
