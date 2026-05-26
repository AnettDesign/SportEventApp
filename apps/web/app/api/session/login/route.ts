import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const body = await req.json();
  const apiUrl = process.env.API_URL!;

  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return new Response(JSON.stringify(data ?? { message: 'Login failed' }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = data?.accessToken as string | undefined;
  const user = data?.user as { role?: string; name?: string } | undefined;
  if (!token) {
    return new Response(JSON.stringify({ message: 'No accessToken returned' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookieStore = await cookies();
  cookieStore.set('access_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  cookieStore.set('user_role', user?.role ?? 'USER', {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });
  cookieStore.set('user_name', user?.name ?? 'Користувач', {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });

  return new Response(JSON.stringify({ user: data.user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
