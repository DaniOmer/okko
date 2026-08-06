import { NextRequest, NextResponse } from 'next/server';
import { decodeToken, type Role, TENANT_ROLES } from '@/lib/jwt';

const ZONES: { prefixes: string[]; allow: Role[] }[] = [
  { prefixes: ['/crops', '/zones', '/pests', '/history'], allow: ['superadmin'] },
  { prefixes: ['/fiches'], allow: TENANT_ROLES },
  { prefixes: ['/membres'], allow: ['admin', ...TENANT_ROLES] },
];

function isPublic(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register' || pathname.startsWith('/invite/') || pathname.startsWith('/confirm/');
}
function inZone(pathname: string, zones: string[]): boolean {
  return zones.some((z) => pathname === z || pathname.startsWith(z + '/'));
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (pathname === '/logout') return NextResponse.next();
  const session = decodeToken(req.cookies.get('okko_session')?.value);

  if (isPublic(pathname)) {
    return session ? NextResponse.redirect(new URL('/', req.url)) : NextResponse.next();
  }
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const role: Role = session.role;
  for (const z of ZONES) {
    if (inZone(pathname, z.prefixes) && !z.allow.includes(role)) return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|css|js)$).*)'],
};
