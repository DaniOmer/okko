import { describe, it, expect, vi, beforeEach } from 'vitest';

const { redirectMock, setSession, clearSession, apiLogin, ApiError } = vi.hoisted(() => {
  class ApiError extends Error { constructor(public status: number) { super(String(status)); } }
  return {
    redirectMock: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
    setSession: vi.fn(),
    clearSession: vi.fn(),
    apiLogin: vi.fn(),
    ApiError,
  };
});

vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock('./session', () => ({ setSession: (t: string) => setSession(t), clearSession: () => clearSession() }));
vi.mock('./api', () => ({ apiLogin: (...a: unknown[]) => apiLogin(...a), apiRegister: vi.fn(), apiAcceptInvite: vi.fn(), ApiError }));

import { loginAction } from './auth-actions';

function form(data: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.append(k, v);
  return f;
}

describe('loginAction', () => {
  beforeEach(() => { redirectMock.mockClear(); setSession.mockClear(); apiLogin.mockReset(); });
  it('succès → pose la session puis redirige vers /', async () => {
    apiLogin.mockResolvedValue({ token: 'jwt', user: {} });
    await expect(loginAction({}, form({ email: 'a@b.c', password: 'pw' }))).rejects.toThrow('REDIRECT:/');
    expect(setSession).toHaveBeenCalledWith('jwt');
  });
  it('401 → renvoie une erreur, pas de redirect', async () => {
    apiLogin.mockRejectedValue(new ApiError(401));
    const res = await loginAction({}, form({ email: 'a@b.c', password: 'bad' }));
    expect(res.error).toMatch(/identifiants/i);
    expect(setSession).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
