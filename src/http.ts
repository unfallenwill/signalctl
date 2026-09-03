import type { SignalctlConfig } from './config.js';
import { SignalctlError } from './errors.js';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  timeoutMs?: number;
  proxyUid?: string;
  datasourcePath?: string;
  extraPath?: string;
  accept?: string;
}

function buildUrl(server: string, opts: RequestOptions): string {
  const path = opts.extraPath ?? '';
  let base = server;
  if (opts.proxyUid) {
    base = `${base}/api/datasources/proxy/uid/${encodeURIComponent(opts.proxyUid)}`;
    if (opts.datasourcePath) {
      base = `${base}/${opts.datasourcePath.replace(/^\/+/, '')}`;
    }
  }
  const full = `${base}${path}`;
  if (opts.query) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      usp.set(k, String(v));
    }
    const q = usp.toString();
    if (q) return `${full}?${q}`;
  }
  return full;
}

function mapStatus(status: number, body: unknown): SignalctlError {
  const snippet = typeof body === 'string' ? body.slice(0, 500) : body;
  if (status === 401 || status === 403) {
    return new SignalctlError(
      'auth_error',
      `grafana rejected credentials (HTTP ${status})`,
      snippet
    );
  }
  if (status === 404) {
    return new SignalctlError('not_found', `not found (HTTP 404)`, snippet);
  }
  if (status === 400) {
    return new SignalctlError('validation_error', `bad request (HTTP 400)`, snippet);
  }
  if (status >= 500) {
    return new SignalctlError('server_error', `grafana upstream error (HTTP ${status})`, snippet);
  }
  return new SignalctlError('server_error', `unexpected HTTP ${status}`, snippet);
}

export async function grafanaRequest<T>(cfg: SignalctlConfig, opts: RequestOptions): Promise<T> {
  const url = buildUrl(cfg.server, opts);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: opts.accept ?? 'application/json'
  };
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? cfg.timeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    signal: controller.signal
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') {
      throw new SignalctlError('timeout', `request timed out after ${timeoutMs}ms (${url})`);
    }
    throw new SignalctlError(
      'network_error',
      `network error: ${(e as Error).message ?? String(e)}`,
      { url }
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    throw mapStatus(res.status, text);
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SignalctlError('parse_error', `failed to parse JSON response`, {
      snippet: text.slice(0, 500)
    });
  }
}

export async function grafanaRequestText(
  cfg: SignalctlConfig,
  opts: RequestOptions
): Promise<string> {
  const url = buildUrl(cfg.server, opts);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: opts.accept ?? 'application/x-ndjson'
  };
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? cfg.timeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    signal: controller.signal
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') {
      throw new SignalctlError('timeout', `request timed out after ${timeoutMs}ms (${url})`);
    }
    throw new SignalctlError(
      'network_error',
      `network error: ${(e as Error).message ?? String(e)}`,
      { url }
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    throw mapStatus(res.status, text);
  }
  return text;
}
