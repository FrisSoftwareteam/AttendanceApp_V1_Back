type Fetcher = typeof fetch;

type FetchJsonOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export async function getFetch(): Promise<Fetcher> {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }
  const mod = await import("node-fetch");
  return (mod.default as unknown as Fetcher).bind(globalThis);
}

export async function fetchJson(fetcher: Fetcher, url: string, options: FetchJsonOptions = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      headers: options.headers
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
