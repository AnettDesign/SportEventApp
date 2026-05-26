type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return new Response(JSON.stringify({ message: 'API_URL is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await ctx.params;
  const res = await fetch(`${apiUrl}/events/${id}`, { method: 'GET', cache: 'no-store' });
  const data = await res.text();

  return new Response(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
