'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction, type ActionState } from '@/lib/auth-actions';
import { ResendConfirmation } from '@/components/ResendConfirmation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Connexion…' : 'Se connecter'}</Button>;
}

export function LoginForm() {
  const [state, action] = useFormState<ActionState, FormData>(loginAction, {});
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
        <div className="space-y-1.5"><Label htmlFor="password">Mot de passe</Label><Input id="password" name="password" type="password" required autoComplete="current-password" /></div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <SubmitButton />
      </form>
      {state.needsConfirmation && (
        <div className="rounded-md border p-3">
          <p className="mb-2 text-sm text-muted-foreground">Vous n'avez pas confirmé votre email ?</p>
          <ResendConfirmation email={state.email} />
        </div>
      )}
    </div>
  );
}
