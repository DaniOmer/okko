'use server';

import { revalidatePath } from 'next/cache';
import { apiCreateInvitation, apiRevokeInvitation, ApiError } from '@/lib/api';

export type InviteState = { error?: string; ok?: boolean; emailSent?: boolean };

export async function inviteAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const email = String(form.get('email') ?? '').trim();
  const role = String(form.get('role') ?? '').trim();
  if (!email) return { error: 'Email requis.' };
  if (!role) return { error: 'Rôle requis.' };
  try {
    const { emailSent } = await apiCreateInvitation(email, role);
    revalidatePath('/membres');
    return { ok: true, emailSent };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return { error: 'Cette personne est déjà membre ou déjà invitée.' };
    if (e instanceof ApiError && e.status === 400) return { error: 'Rôle invalide pour cette organisation.' };
    return { error: 'Une erreur est survenue. Réessayez.' };
  }
}

export async function revokeAction(id: string): Promise<void> {
  await apiRevokeInvitation(id);
  revalidatePath('/membres');
}
