import { AcceptForm } from './AcceptForm';

export default function InvitePage({ params }: { params: { token: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center text-2xl font-extrabold text-primary">🌱 Okko</div>
      <h1 className="text-center text-lg font-semibold">Rejoindre l'organisation</h1>
      <p className="text-center text-sm text-muted-foreground">Choisissez votre nom et un mot de passe pour finaliser.</p>
      <AcceptForm token={params.token} />
    </main>
  );
}
