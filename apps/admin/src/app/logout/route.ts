import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL('/login?expired=1', req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
