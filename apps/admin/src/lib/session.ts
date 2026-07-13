import { cookies } from 'next/headers';
import { decodeToken, type SessionUser } from './jwt';

export const SESSION_COOKIE = 'okko_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

export function getToken(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}
export function getSession(): SessionUser | null {
  return decodeToken(getToken());
}
export function setSession(token: string): void {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    path: '/', maxAge: MAX_AGE,
  });
}
export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}
