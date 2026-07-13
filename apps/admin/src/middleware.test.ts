import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function makeToken(role: string, orgId: string | null): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'u', email: 'a@b.c', role, organizationId: orgId, iat: 1, exp })}.sig`;
}
function req(path: string, token?: string): NextRequest {
  const r = new NextRequest(new URL(`http://localhost:3000${path}`));
  if (token) r.cookies.set('okko_session', token);
  return r;
}
function loc(res: { headers: Headers; status: number }): string | null {
  return res.status >= 300 && res.status < 400 ? new URL(res.headers.get('location')!).pathname : null;
}

describe('middleware', () => {
  it('route protégée sans session → /login', () => { expect(loc(middleware(req('/crops')))).toBe('/login'); });
  it('route publique avec session → /', () => { expect(loc(middleware(req('/login', makeToken('admin', 'o1'))))).toBe('/'); });
  it('mauvais rôle sur zone superadmin → /', () => { expect(loc(middleware(req('/crops', makeToken('admin', 'o1'))))).toBe('/'); });
  it('bon rôle sur sa zone → passe', () => {
    expect(loc(middleware(req('/crops', makeToken('superadmin', null))))).toBeNull();
    expect(loc(middleware(req('/membres', makeToken('admin', 'o1'))))).toBeNull();
  });
  it('editor sur /bientot → passe', () => { expect(loc(middleware(req('/bientot', makeToken('editor', 'o1'))))).toBeNull(); });
  it('invitation publique sans session → passe', () => { expect(loc(middleware(req('/invite/tok123')))).toBeNull(); });
});
