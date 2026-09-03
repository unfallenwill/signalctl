import { describe, expect, it } from 'vitest';
import { commandPath, getDoc } from '../help.js';

describe('help.getDoc', () => {
  it('returns doc for known commands', () => {
    const doc = getDoc('metrics/query');
    expect(doc).toBeDefined();
    expect(doc?.example).toContain('vector(1)');
    expect(doc?.returns?.type).toBe('json-array');
  });

  it('returns undefined for unknown command path', () => {
    expect(getDoc('unknown/cmd')).toBeUndefined();
  });

  it('documents all 12 command paths', () => {
    const paths = [
      'metrics/query',
      'metrics/range',
      'metrics/series',
      'metrics/labels',
      'metrics/label-values',
      'logs/query',
      'traces/services',
      'traces/get',
      'traces/trace',
      'datasources/list',
      'version'
    ];
    for (const p of paths) {
      expect(getDoc(p), `missing doc for ${p}`).toBeDefined();
    }
  });

  it('traces/get doc warns about multi-root traces', () => {
    const doc = getDoc('traces/get');
    expect(doc?.notes).toMatch(/multi-root/i);
  });
});

describe('help.commandPath', () => {
  it('joins parts', () => {
    expect(commandPath(['metrics', 'query'])).toBe('metrics/query');
  });
  it('filters empty parts', () => {
    expect(commandPath(['', 'logs', '', 'query'])).toBe('logs/query');
  });
  it('handles empty', () => {
    expect(commandPath([])).toBe('');
  });
});
