'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { resendConfirmationAction, type ActionState } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="outline" disabled={pending}>{pending ? 'Envoi…' : label}</Button>;
}

/** Si `email` est fourni, il est envoyé en champ caché (bouton simple) ; sinon un champ email est affiché. */
export function ResendConfirmation({ email, label = 'Renvoyer l’email de confirmation' }: { email?: string; label?: string }) {
  const [state, action] = useFormState<ActionState, FormData>(resendConfirmationAction, {});
  return (
    <form action={action} className="space-y-2">
      {email ? <input type="hidden" name="email" value={email} /> : <Input name="email" type="email" placeholder="votre@email" required aria-label="Email" />}
      {state.ok ? <p className="text-sm text-muted-foreground">Si un compte non confirmé existe, un nouvel email a été envoyé.</p> : <SubmitButton label={label} />}
    </form>
  );
}
