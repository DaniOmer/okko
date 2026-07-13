import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
vi.mock('./session', () => ({ getToken: () => 'jwt-xyz' }));

import { apiListInvitations, apiLogin, ApiError } from './api';

describe('api auth', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('apiListInvitations attache le Bearer', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }));
    await apiListInvitations();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/auth/invitations');
    expect((init!.headers as Headers).get('authorization')).toBe('Bearer jwt-xyz');
  });
  it('apiLogin lève ApiError(401) sur mauvais identifiants', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    await expect(apiLogin('a@b.c', 'bad')).rejects.toBeInstanceOf(ApiError);
  });
});
