import { cookies } from 'next/headers';

async function authHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export async function GET() {
  const apiUrl = process.env.API_URL!;
  const auth = await authHeader();
  if (!auth) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(`${apiUrl}/bookings/my-waitlist`, {
    method: 'GET',
    headers: { ...auth },
  });

  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
