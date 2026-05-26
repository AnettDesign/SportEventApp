import { cookies } from 'next/headers';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) return null;

  return {
    Authorization: `Bearer ${token}`,
  };
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, ctx: RouteContext) {
  const auth = await getAuthHeaders();
  const { id } = await ctx.params;

  const res = await fetch(`${apiUrl}/events/${id}`, {
    method: 'GET',
    headers: {
      ...(auth ?? {}),
    },
    cache: 'no-store',
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/json',
    },
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const auth = await getAuthHeaders();
  if (!auth) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await ctx.params;
  const body = await req.json();

  const res = await fetch(`${apiUrl}/events/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...auth,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/json',
    },
  });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const auth = await getAuthHeaders();
  if (!auth) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await ctx.params;

  const res = await fetch(`${apiUrl}/events/${id}`, {
    method: 'DELETE',
    headers: {
      ...auth,
    },
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/json',
    },
  });
}