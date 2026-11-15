import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  const loginUrl = new URL('/login', req.url);
  if (!token) return NextResponse.redirect(loginUrl);
  try {
    const key = new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-only-secret');
    const { payload } = await jwtVerify(token, key);
    const path = req.nextUrl.pathname;
    if (path.startsWith('/admin') && payload.role !== 'admin') return NextResponse.redirect(new URL('/teacher', req.url));
    if (path.startsWith('/teacher') && payload.role !== 'teacher') return NextResponse.redirect(new URL('/admin', req.url));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = { matcher: ['/admin/:path*', '/teacher/:path*', '/api/wa', '/api/attendance'] };
