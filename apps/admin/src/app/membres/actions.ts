'use server';

import { revalidatePath } from 'next/cache';
import { apiCreateInvitation, apiRevokeInvitation, ApiError } from '@/lib/api';

export type InviteState = { error?: string; ok?: boolean; emailSent?: boolean };

export async function inviteAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const email = String(form.get('email') ?? '').trim();
  if (!email) return { error: 'Email requis.' };
  try {
    const { emailSent } = await apiCreateInvitation(email);
    revalidatePath('/membres');
    return { ok: true, emailSent };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return { error: 'Cette personne est déjà membre ou déjà invitée.' };
    return { error: 'Une erreur est survenue. Réessayez.' };
  }
}

export async function revokeAction(id: string): Promise<void> {
  await apiRevokeInvitation(id);
  revalidatePath('/membres');
}
