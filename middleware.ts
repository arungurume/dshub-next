import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// All protected admin page paths (route group (admin) maps directly to these URLs)
const PROTECTED_PATHS = [
  '/dashboard',
  '/content',
  '/screens',
  '/playlists',
  '/schedules',
  '/locations',
  '/users',
  '/my-account',
  '/templates',
  '/settings',
];

const AUTH_PAGES = ['/signin', '/signup', '/forgot-password', '/password-reset', '/confirm-email'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  // Protect admin pages — redirect to signin if no token
  const isProtected = PROTECTED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isProtected && !token) {
    const url = new URL('/signin', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect already-authenticated users away from auth pages
  const isAuthPage = AUTH_PAGES.some(p => pathname.startsWith(p));
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/content/:path*',
    '/screens/:path*',
    '/playlists/:path*',
    '/schedules/:path*',
    '/locations/:path*',
    '/users/:path*',
    '/my-account/:path*',
    '/templates/:path*',
    '/settings/:path*',
    '/signin',
    '/signup',
    '/forgot-password',
    '/password-reset',
    '/confirm-email',
  ],
};
