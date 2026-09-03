import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  color,
  isColorEnabled,
  isTty,
  writeJson,
  writeNdjson,
  writeStderr,
  writeTable
} from '../output.js';

const stdoutChunks: string[] = [];
const stderrChunks: string[] = [];
const origStdoutWrite = process.stdout.write.bind(process.stdout);
const origStderrWrite = process.stderr.write.bind(process.stderr);

beforeEach(() => {
  stdoutChunks.length = 0;
  stderrChunks.length = 0;
  process.stdout.write = ((chunk: unknown) => {
    stdoutChunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown) => {
    stderrChunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
});

afterEach(() => {
  process.stdout.write = origStdoutWrite;
  process.stderr.write = origStderrWrite;
});

describe('writeJson', () => {
  it('emits JSON on stdout with newline', () => {
    writeJson({ a: 1 });
    expect(stdoutChunks).toHaveLength(1);
    expect(stdoutChunks[0]?.endsWith('\n')).toBe(true);
    expect(JSON.parse(stdoutChunks[0] ?? '{}')).toEqual({ a: 1 });
  });

  it('honors explicit pretty=false', () => {
    writeJson({ a: 1 }, { pretty: false });
    expect(stdoutChunks[0]).toBe('{"a":1}\n');
  });

  it('honors explicit pretty=true', () => {
    writeJson({ a: 1 }, { pretty: true });
    expect(stdoutChunks[0] ?? '').toContain('\n');
  });
});

describe('writeNdjson', () => {
  it('emits one JSON object per line', () => {
    writeNdjson([{ a: 1 }, { a: 2 }]);
    expect(stdoutChunks).toEqual(['{"a":1}\n', '{"a":2}\n']);
  });

  it('handles empty array', () => {
    writeNdjson([]);
    expect(stdoutChunks).toHaveLength(0);
  });
});

describe('writeTable', () => {
  it('emits header, separator, and rows', () => {
    writeTable(['A', 'B'], [['x', 'y']], false);
    expect(stdoutChunks.length).toBe(3);
    expect(stdoutChunks[0] ?? '').toContain('A');
    expect(stdoutChunks[0] ?? '').toContain('B');
    expect(stdoutChunks[2] ?? '').toContain('x');
  });

  it('emits header only when rows empty', () => {
    writeTable(['A'], [], false);
    expect(stdoutChunks.length).toBe(1);
  });

  it('applies ANSI color when enabled', () => {
    writeTable(['A'], [['x']], true);
    expect(stdoutChunks[0] ?? '').toContain('\x1b[1m');
  });

  it('skips ANSI color when disabled', () => {
    writeTable(['A'], [['x']], false);
    expect(stdoutChunks[0] ?? '').not.toContain('\x1b[');
  });
});

describe('writeStderr', () => {
  it('writes JSON to stderr', () => {
    writeStderr({ error: 'auth_error' });
    expect(stderrChunks.length).toBe(1);
    expect(JSON.parse(stderrChunks[0] ?? '{}')).toEqual({ error: 'auth_error' });
  });
});

describe('isTty / isColorEnabled / color', () => {
  it('isTty returns boolean', () => {
    expect(typeof isTty()).toBe('boolean');
  });

  it('isColorEnabled returns false when noColor flag set', () => {
    expect(isColorEnabled(true)).toBe(false);
  });

  it('isColorEnabled honors NO_COLOR env', () => {
    const orig = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    try {
      expect(isColorEnabled(false)).toBe(false);
    } finally {
      if (orig === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = orig;
    }
  });

  it('isColorEnabled honors FORCE_COLOR env', () => {
    const orig = process.env.FORCE_COLOR;
    process.env.FORCE_COLOR = '1';
    try {
      expect(isColorEnabled(false)).toBe(true);
    } finally {
      if (orig === undefined) delete process.env.FORCE_COLOR;
      else process.env.FORCE_COLOR = orig;
    }
  });

  it('color wraps text when enabled', () => {
    expect(color('x', 'red', true)).toContain('\x1b[31m');
    expect(color('x', 'red', false)).toBe('x');
  });
});
