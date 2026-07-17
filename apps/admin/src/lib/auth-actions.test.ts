import { describe, it, expect, vi, beforeEach } from 'vitest';

const { redirectMock, setSession, clearSession, apiLogin, apiRegister, ApiError } = vi.hoisted(() => {
  class ApiError extends Error { constructor(public status: number) { super(String(status)); } }
  return {
    redirectMock: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
    setSession: vi.fn(),
    clearSession: vi.fn(),
    apiLogin: vi.fn(),
    apiRegister: vi.fn(),
    ApiError,
  };
});

vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock('./session', () => ({ setSession: (t: string) => setSession(t), clearSession: () => clearSession() }));
vi.mock('./api', () => ({
  apiLogin: (...a: unknown[]) => apiLogin(...a),
  apiRegister: (...a: unknown[]) => apiRegister(...a),
  apiAcceptInvite: vi.fn(), apiConfirmEmail: vi.fn(), apiResendConfirmation: vi.fn(), ApiError,
}));

import { loginAction, registerAction } from './auth-actions';

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

describe('registerAction', () => {
  beforeEach(() => { apiRegister.mockReset(); });
  it('succès → { ok, email }, pas de redirect', async () => {
    apiRegister.mockResolvedValue({ status: 'confirmation_sent', email: 'a@b.c' });
    const res = await registerAction({}, (() => { const f = new FormData(); f.append('email', 'a@b.c'); f.append('password', 'pw'); f.append('name', 'A'); f.append('organizationName', 'Coop'); return f; })());
    expect(res).toEqual({ ok: true, email: 'a@b.c' });
  });
});

describe('loginAction non confirmé', () => {
  beforeEach(() => { apiLogin.mockReset(); });
  it('403 → needsConfirmation', async () => {
    apiLogin.mockRejectedValue(new ApiError(403));
    const f = new FormData(); f.append('email', 'a@b.c'); f.append('password', 'pw');
    const res = await loginAction({}, f);
    expect(res.needsConfirmation).toBe(true);
    expect(res.email).toBe('a@b.c');
  });
});
