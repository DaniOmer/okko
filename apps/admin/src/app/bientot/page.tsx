import { logoutAction } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';

export default function BientotPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-3xl">🌱</div>
      <h1 className="text-xl font-semibold">Votre espace arrive bientôt</h1>
      <p className="text-sm text-muted-foreground">
        Le carnet de suivi (parcelles &amp; cycles) sera disponible prochainement. Merci de votre patience.
      </p>
      <form action={logoutAction}>
        <Button type="submit" variant="outline">Se déconnecter</Button>
      </form>
    </main>
  );
}
