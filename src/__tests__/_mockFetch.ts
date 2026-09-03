export interface Captured {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
}

export let captured: Captured;

export function mockFetch(
  status: number,
  body: unknown,
  contentType = 'application/json'
): () => void {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    captured = {
      url: String(url),
      init: init ?? {},
      headers: Object.fromEntries(
        Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [
          k.toLowerCase(),
          v
        ])
      )
    };
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(text, { status, headers: { 'content-type': contentType } });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = orig;
  };
}
