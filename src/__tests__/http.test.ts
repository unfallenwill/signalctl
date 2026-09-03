import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { SignalctlError } from '../errors.js';
import { grafanaRequest, grafanaRequestText } from '../http.js';
import { captured, mockFetch } from './_mockFetch.js';

const cfg = loadConfig({
  GRAFANA_SERVER: 'https://example.test',
  GRAFANA_TOKEN: 'tok'
});

describe('grafanaRequest', () => {
  it('builds proxy URL with auth header', async () => {
    const restore = mockFetch(200, { ok: 1 });
    try {
      await grafanaRequest(cfg, {
        proxyUid: 'uid-x',
        datasourcePath: 'api/v1/query',
        query: { q: 'up', t: 1 }
      });
      expect(captured.url).toContain('/api/datasources/proxy/uid/uid-x/api/v1/query');
      expect(captured.url).toContain('q=up');
      expect(captured.headers.authorization).toBe('Bearer tok');
    } finally {
      restore();
    }
  });

  it('strips trailing slash from server', async () => {
    const cfgSlash = loadConfig({
      GRAFANA_SERVER: 'https://example.test/',
      GRAFANA_TOKEN: 'tok'
    });
    const restore = mockFetch(200, { ok: 1 });
    try {
      await grafanaRequest(cfgSlash, { extraPath: '/api/datasources' });
      expect(captured.url.startsWith('https://example.test/api/datasources')).toBe(true);
    } finally {
      restore();
    }
  });

  it('maps 401 to auth_error', async () => {
    const restore = mockFetch(401, { message: 'bad' });
    try {
      await expect(grafanaRequest(cfg, { extraPath: '/x' })).rejects.toBeInstanceOf(SignalctlError);
    } finally {
      restore();
    }
  });

  it('maps 5xx to server_error', async () => {
    const restore = mockFetch(500, 'boom');
    try {
      await expect(grafanaRequest(cfg, { extraPath: '/x' })).rejects.toMatchObject({
        code: 'server_error'
      });
    } finally {
      restore();
    }
  });

  it('truncates large error body to 500 chars', async () => {
    const huge = 'x'.repeat(10_000);
    const restore = mockFetch(500, huge);
    try {
      await expect(grafanaRequest(cfg, { extraPath: '/x' })).rejects.toMatchObject({
        code: 'server_error',
        detail: huge.slice(0, 500)
      });
    } finally {
      restore();
    }
  });

  it('parses JSON on success', async () => {
    const restore = mockFetch(200, { hello: 'world' });
    try {
      const r = await grafanaRequest<{ hello: string }>(cfg, { extraPath: '/x' });
      expect(r.hello).toBe('world');
    } finally {
      restore();
    }
  });

  it('reports parse_error on invalid JSON', async () => {
    const restore = mockFetch(200, 'not-json', 'text/plain');
    try {
      await expect(grafanaRequest(cfg, { extraPath: '/x' })).rejects.toMatchObject({
        code: 'parse_error'
      });
    } finally {
      restore();
    }
  });

  it('throws timeout when fetch is aborted', async () => {
    const restore = mockFetch(200, {}, 'application/json');
    // replace with an explicitly aborting impl
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Promise<Response>((_resolve, reject) => {
        setTimeout(() => {
          const e = new Error('aborted');
          (e as { name?: string }).name = 'AbortError';
          reject(e);
        }, 20);
      })) as typeof fetch;
    try {
      await expect(grafanaRequest(cfg, { extraPath: '/x', timeoutMs: 5 })).rejects.toMatchObject({
        code: 'timeout'
      });
    } finally {
      globalThis.fetch = orig;
      restore();
    }
  });

  it('grafanaRequestText maps 404 to not_found', async () => {
    const restore = mockFetch(404, 'not here', 'text/plain');
    try {
      await expect(grafanaRequestText(cfg, { extraPath: '/x' })).rejects.toMatchObject({
        code: 'not_found'
      });
    } finally {
      restore();
    }
  });

  it('grafanaRequestText returns empty string on empty body', async () => {
    const restore = mockFetch(200, '', 'text/plain');
    try {
      const text = await grafanaRequestText(cfg, { extraPath: '/x' });
      expect(text).toBe('');
    } finally {
      restore();
    }
  });

  it('grafanaRequestText maps 5xx to server_error', async () => {
    const restore = mockFetch(500, 'oops', 'text/plain');
    try {
      await expect(grafanaRequestText(cfg, { extraPath: '/x' })).rejects.toMatchObject({
        code: 'server_error'
      });
    } finally {
      restore();
    }
  });

  it('grafanaRequestText maps 401 to auth_error', async () => {
    const restore = mockFetch(401, 'unauthorized', 'text/plain');
    try {
      await expect(grafanaRequestText(cfg, { extraPath: '/x' })).rejects.toMatchObject({
        code: 'auth_error'
      });
    } finally {
      restore();
    }
  });

  it('grafanaRequestText maps 400 to validation_error', async () => {
    const restore = mockFetch(400, 'bad', 'text/plain');
    try {
      await expect(grafanaRequestText(cfg, { extraPath: '/x' })).rejects.toMatchObject({
        code: 'validation_error'
      });
    } finally {
      restore();
    }
  });
});
