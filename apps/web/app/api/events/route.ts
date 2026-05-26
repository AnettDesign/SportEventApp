export async function GET(req: Request) {
  const apiUrl = process.env.API_URL;

  if (!apiUrl) {
    return new Response(JSON.stringify({ message: 'API_URL is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const search = url.searchParams.toString();
  const target = `${apiUrl}/events${search ? `?${search}` : ''}`;

  const res = await fetch(target, { method: 'GET', cache: 'no-store' });
  const data = await res.text();

  return new Response(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
