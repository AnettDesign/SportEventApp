import { cookies } from 'next/headers';

async function authHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export async function POST(req: Request) {
  const apiUrl = process.env.API_URL!;
  const body = await req.json();
  const auth = await authHeader();
  if (!auth) return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });

  const res = await fetch(`${apiUrl}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body),
  });

  const data = await res.text();
  return new Response(data, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' } });
}