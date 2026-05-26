import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_PATHS = ['/my-bookings', '/notifications', '/create-event', '/organizer', '/analytics'];
const ORGANIZER_ONLY = ['/create-event', '/organizer'];
const ADMIN_ONLY = ['/analytics'];

function matches(pathname: string, targets: string[]) {
  return targets.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function roleHome(role?: string | null) {
  if (role === 'ORGANIZER') return '/organizer/events';
  if (role === 'ADMIN') return '/analytics';
  return '/events';
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('access_token')?.value;
  const role = req.cookies.get('user_role')?.value;

  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL(roleHome(role), req.url));
  }

  if (!matches(pathname, AUTH_PATHS)) return NextResponse.next();

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (matches(pathname, ORGANIZER_ONLY) && role !== 'ORGANIZER' && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/events', req.url));
  }

  if (matches(pathname, ADMIN_ONLY) && role !== 'ADMIN') {
    return NextResponse.redirect(new URL(roleHome(role), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/my-bookings/:path*', '/notifications/:path*', '/create-event/:path*', '/organizer/:path*', '/analytics/:path*'],
};
