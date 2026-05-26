export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type HttpError = {
  status: number;
  message: string;
  details?: unknown;
};

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function http<TResponse>(
  path: string,
  opts?: {
    method?: HttpMethod;
    baseUrl?: string; // '' для Next rewrites, або 'http://localhost:3001' для прямого виклику
    token?: string;
    body?: unknown;
    query?: Record<string, unknown>;
    headers?: Record<string, string>;
  },
): Promise<TResponse> {
  const method = opts?.method ?? 'GET';
  const baseUrl = opts?.baseUrl ?? '';
  const url = `${baseUrl}${path}${toQuery(opts?.query)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts?.headers ?? {}),
  };

  if (opts?.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  // якщо бек повертає не-JSON — не ламаємось
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const err: HttpError = {
      status: res.status,
      message:
        (payload && typeof payload === 'object' && 'message' in payload && (payload as any).message) ||
        res.statusText ||
        'Request failed',
      details: payload,
    };
    throw err;
  }

  return payload as TResponse;
}