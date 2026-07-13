import { describe, it, expect } from 'vitest';
import { decodeToken } from './jwt';

function makeToken(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}
const future = Math.floor(Date.now() / 1000) + 3600;
const past = Math.floor(Date.now() / 1000) - 3600;

describe('decodeToken', () => {
  it('décode un token valide', () => {
    const t = makeToken({ sub: 'u1', email: 'a@b.c', role: 'admin', organizationId: 'o1', iat: 1, exp: future });
    expect(decodeToken(t)).toEqual({ sub: 'u1', email: 'a@b.c', role: 'admin', organizationId: 'o1' });
  });
  it('accepte organizationId null (superadmin)', () => {
    const t = makeToken({ sub: 's1', email: 's@o.dev', role: 'superadmin', organizationId: null, iat: 1, exp: future });
    expect(decodeToken(t)?.role).toBe('superadmin');
    expect(decodeToken(t)?.organizationId).toBeNull();
  });
  it('renvoie null si expiré', () => {
    const t = makeToken({ sub: 'u1', email: 'a@b.c', role: 'admin', organizationId: 'o1', iat: 1, exp: past });
    expect(decodeToken(t)).toBeNull();
  });
  it('renvoie null si malformé', () => {
    expect(decodeToken('pas-un-jwt')).toBeNull();
    expect(decodeToken('')).toBeNull();
  });
  it('renvoie null si des champs manquent', () => {
    expect(decodeToken(makeToken({ sub: 'u1', exp: future }))).toBeNull();
  });
});
