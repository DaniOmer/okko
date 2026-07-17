'use client';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { confirmAction, type ConfirmState } from '@/lib/auth-actions';
import { ResendConfirmation } from '@/components/ResendConfirmation';
import { Button } from '@/components/ui/button';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Vérification…' : 'Confirmer mon inscription'}</Button>;
}

export function ConfirmForm({ token }: { token: string }) {
  const [state, formAction] = useFormState<ConfirmState, FormData>(confirmAction.bind(null, token), {});

  if (state.status === 'confirmed') {
    return (
      <div className="space-y-4">
        <div className="text-3xl">✅</div>
        <p className="text-sm">Votre compte est confirmé. Vous pouvez maintenant vous connecter.</p>
        <Link href="/login"><Button className="w-full">Se connecter</Button></Link>
      </div>
    );
  }
  if (state.status === 'invalid') {
    return (
      <div className="space-y-4">
        <div className="text-3xl">⚠️</div>
        <p className="text-sm">Ce lien de confirmation est invalide ou expiré.</p>
        <ResendConfirmation label="Recevoir un nouveau lien" />
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">Cliquez pour finaliser votre inscription.</p>
      <SubmitButton />
    </form>
  );
}
