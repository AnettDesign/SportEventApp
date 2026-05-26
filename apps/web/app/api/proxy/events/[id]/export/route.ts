import { cookies } from 'next/headers';

async function authHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const auth = await authHeader();
  if (!auth) return new Response('Unauthorized', { status: 401 });
  if (!apiUrl) return new Response('API_URL is not configured', { status: 500 });

  const { id } = await ctx.params;
  const res = await fetch(`${apiUrl}/events/${id}/bookings/export`, { headers: { ...auth } });
  const csv = await res.text();
  return new Response(csv, {
    status: res.status,
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': res.headers.get('content-disposition') ?? '' },
  });
}
