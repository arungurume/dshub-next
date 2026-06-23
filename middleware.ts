import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    if (!token) {
      // Redirect to signin, saving the original pathname as a redirect query
      const url = new URL('/signin', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated users away from auth pages
  const authPages = ['/signin', '/signup', '/forgot-password', '/password-reset'];
  if (authPages.some(page => pathname.startsWith(page))) {
    if (token) {
      // User is already logged in, send them to dashboard
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

// Config to specify matching routes for the middleware
export const config = {
  matcher: [
    '/admin/:path*',
    '/signin',
    '/signup',
    '/forgot-password',
    '/password-reset',
  ],
};
