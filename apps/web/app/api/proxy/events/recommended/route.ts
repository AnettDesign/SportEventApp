import { cookies } from 'next/headers';

async function authHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export async function GET(req: Request) {
  const apiUrl = process.env.API_URL!;
  const auth = await authHeader();

  if (!auth) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const limit = url.searchParams.get('limit') ?? '6';

  const res = await fetch(`${apiUrl}/events/recommended?limit=${encodeURIComponent(limit)}`, {
    method: 'GET',
    headers: { ...auth },
  });

  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}