import Link from 'next/link';
import { LoginForm } from './LoginForm';

export default function LoginPage({ searchParams }: { searchParams: { expired?: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center text-2xl font-extrabold text-primary">🌱 Okko</div>
      {searchParams.expired && (
        <p className="rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
          Votre session a expiré. Reconnectez-vous.
        </p>
      )}
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ? <Link href="/register" className="text-primary hover:underline">Créer une organisation</Link>
      </p>
    </main>
  );
}
