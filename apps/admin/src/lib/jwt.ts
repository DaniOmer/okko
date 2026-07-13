export type Role = 'superadmin' | 'admin' | 'editor';

export interface SessionUser {
  sub: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

const ROLES: Role[] = ['superadmin', 'admin', 'editor'];

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Décode le payload d'un JWT (lecture seule, sans vérif de signature — l'API la revérifie).
 *  Renvoie null si le token est absent, malformé, incomplet ou expiré. */
export function decodeToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const p = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    if (typeof p.exp === 'number' && p.exp * 1000 <= Date.now()) return null;
    if (typeof p.sub !== 'string' || typeof p.email !== 'string') return null;
    if (typeof p.role !== 'string' || !ROLES.includes(p.role as Role)) return null;
    const org = p.organizationId;
    if (org !== null && typeof org !== 'string') return null;
    return { sub: p.sub, email: p.email, role: p.role as Role, organizationId: org };
  } catch {
    return null;
  }
}
