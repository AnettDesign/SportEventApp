import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set('access_token', '', { httpOnly: true, path: '/', maxAge: 0 });
  cookieStore.set('user_role', '', { path: '/', maxAge: 0 });
  cookieStore.set('user_name', '', { path: '/', maxAge: 0 });
  return new Response(null, { status: 204 });
}
