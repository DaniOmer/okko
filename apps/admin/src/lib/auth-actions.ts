'use server';

import { redirect } from 'next/navigation';
import { setSession, clearSession } from './session';
import { apiLogin, apiRegister, apiAcceptInvite, ApiError } from './api';

export type ActionState = { error?: string };

function messageFor(e: unknown, map: Record<number, string>): string {
  if (e instanceof ApiError && map[e.status]) return map[e.status];
  return 'Une erreur est survenue. Réessayez.';
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  try {
    const { token } = await apiLogin(email, password);
    setSession(token);
  } catch (e) {
    return { error: messageFor(e, { 401: 'Identifiants invalides.' }) };
  }
  redirect('/');
}

export async function registerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const input = {
    organizationName: String(form.get('organizationName') ?? ''),
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  };
  try {
    const { token } = await apiRegister(input);
    setSession(token);
  } catch (e) {
    return { error: messageFor(e, { 409: 'Cet email est déjà utilisé.' }) };
  }
  redirect('/');
}

export async function acceptInviteAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const input = { name: String(form.get('name') ?? ''), password: String(form.get('password') ?? '') };
  try {
    const { token: jwt } = await apiAcceptInvite(token, input);
    setSession(jwt);
  } catch (e) {
    return { error: messageFor(e, { 410: 'Ce lien d’invitation est invalide ou expiré.', 409: 'Cet email est déjà utilisé.' }) };
  }
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  clearSession();
  redirect('/login');
}
