import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({})); // le paquet server-only lève hors RSC — no-op en test
const redirectMock = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); });
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));
const getTokenMock = vi.fn<() => string | null>();
vi.mock('./session', () => ({ getToken: () => getTokenMock() }));

import { authFetch, publicFetch, ApiError } from './http';

describe('http', () => {
  beforeEach(() => { redirectMock.mockClear(); getTokenMock.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('authFetch attache le Bearer', async () => {
    getTokenMock.mockReturnValue('jwt-123');
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await authFetch('/x');
    const [, init] = fetchMock.mock.calls[0];
    expect((init!.headers as Headers).get('authorization')).toBe('Bearer jwt-123');
  });
  it('authFetch redirige vers /login sur 401', async () => {
    getTokenMock.mockReturnValue('jwt');
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    await expect(authFetch('/x')).rejects.toThrow('REDIRECT:/login?expired=1');
  });
  it('authFetch lève ApiError sur autre erreur', async () => {
    getTokenMock.mockReturnValue('jwt');
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 409 }));
    await expect(authFetch('/x')).rejects.toMatchObject({ status: 409 });
  });
  it('publicFetch lève ApiError avec le status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    await expect(publicFetch('/auth/login')).rejects.toBeInstanceOf(ApiError);
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    await expect(publicFetch('/auth/login')).rejects.toMatchObject({ status: 401 });
  });
});
