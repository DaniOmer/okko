import 'server-only';
import { redirect } from 'next/navigation';
import { getToken } from './session';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(public readonly status: number, message?: string) {
    super(message ?? `API ${status}`);
    this.name = 'ApiError';
  }
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function multipartInit(method: string, fd: FormData): RequestInit {
  return { method, body: fd }; // pas de Content-Type : le navigateur pose la boundary multipart
}

/** Appel API authentifié (token du cookie → Bearer). 401 → redirect login. */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: init.cache ?? 'no-store' });
  if (res.status === 401) redirect('/logout');
  if (!res.ok) throw new ApiError(res.status, `${init.method ?? 'GET'} ${path}`);
  return res;
}

/** Appel API public (login/register/accept) — sans token, mappe le status en ApiError. */
export async function publicFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: new Headers(init.headers), cache: 'no-store' });
  if (!res.ok) throw new ApiError(res.status, `${init.method ?? 'GET'} ${path}`);
  return res;
}
