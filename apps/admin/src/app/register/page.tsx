import Link from 'next/link';
import { RegisterForm } from './RegisterForm';

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center text-2xl font-extrabold text-primary">🌱 Okko</div>
      <h1 className="text-center text-lg font-semibold">Créer une organisation</h1>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ? <Link href="/login" className="text-primary hover:underline">Se connecter</Link>
      </p>
    </main>
  );
}
