import { apiInvitationByToken, type InvitationInfo } from '@/lib/api';
import { AcceptForm } from './AcceptForm';

export default async function InvitePage({ params }: { params: { token: string } }) {
  let info: InvitationInfo | null = null;
  try { info = await apiInvitationByToken(params.token); } catch { info = null; }

  if (!info || !info.acceptable) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6 text-center">
        <div className="text-3xl">⚠️</div>
        <h1 className="text-lg font-semibold">Invitation invalide</h1>
        <p className="text-sm text-muted-foreground">Ce lien d'invitation est invalide, expiré ou déjà utilisé.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center text-2xl font-extrabold text-primary">🌱 Okko</div>
      <h1 className="text-center text-lg font-semibold">Rejoindre {info.organizationName}</h1>
      <AcceptForm token={params.token} email={info.email} />
    </main>
  );
}
