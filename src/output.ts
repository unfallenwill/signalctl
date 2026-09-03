export function isTty(): boolean {
  return Boolean(process.stdout.isTTY);
}

export function isColorEnabled(noColorFlag = false): boolean {
  if (noColorFlag) return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
  return isTty();
}

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

export function color(text: string, style: keyof typeof ANSI, enabled: boolean): string {
  if (!enabled) return text;
  return `${ANSI[style]}${text}${ANSI.reset}`;
}

export type FormatKind = 'json' | 'ndjson' | 'table';

export function writeJson(payload: unknown, opts: { pretty?: boolean } = {}): void {
  const pretty = opts.pretty ?? (isTty() && JSON.stringify(payload).length < 50_000);
  const text = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  process.stdout.write(`${text}\n`);
}

export function writeNdjson<T>(items: T[]): void {
  for (const item of items) {
    process.stdout.write(`${JSON.stringify(item)}\n`);
  }
}

export function writeTable(headers: string[], rows: string[][], colorize = false): void {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const fmt = (cells: string[]) => cells.map((c, i) => (c ?? '').padEnd(widths[i] ?? 0)).join('  ');
  process.stdout.write(`${color(fmt(headers), 'bold', colorize)}\n`);
  if (rows.length > 0) {
    process.stdout.write(
      `${color(
        headers
          .map(() => '')
          .map((_, i) => '-'.repeat(widths[i] ?? 0))
          .join('  '),
        'dim',
        colorize
      )}\n`
    );
    for (const r of rows) process.stdout.write(`${fmt(r)}\n`);
  }
}

export function writeStderr(payload: unknown): void {
  process.stderr.write(`${JSON.stringify(payload)}\n`);
}
