import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/setup', '/register', '/api/auth/login', '/api/auth/setup', '/api/auth/register', '/api/settings'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths (exact match or subpath)
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // Lightweight cookie check only (full verification happens in API routes via Node.js crypto)
  const token = request.cookies.get('session')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|socket.io).*)',
  ],
};