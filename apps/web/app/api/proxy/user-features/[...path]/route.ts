import { cookies } from 'next/headers';

const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function authHeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function forward(req: Request, ctx: RouteContext, method: string) {
  const { path } = await ctx.params;
  const source = new URL(req.url);
  const target = `${apiUrl}/user-features/${path.join('/')}${source.search}`;
  const auth = await authHeader();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await req.text();

  const res = await fetch(target, {
    method,
    headers: {
      ...auth,
      ...(body ? { 'Content-Type': req.headers.get('content-type') ?? 'application/json' } : {}),
    },
    body: body || undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export function GET(req: Request, ctx: RouteContext) { return forward(req, ctx, 'GET'); }
export function POST(req: Request, ctx: RouteContext) { return forward(req, ctx, 'POST'); }
export function PUT(req: Request, ctx: RouteContext) { return forward(req, ctx, 'PUT'); }
export function PATCH(req: Request, ctx: RouteContext) { return forward(req, ctx, 'PATCH'); }
