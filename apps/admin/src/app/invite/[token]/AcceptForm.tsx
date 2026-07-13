'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { acceptInviteAction, type ActionState } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Validation…' : 'Rejoindre'}</Button>;
}

export function AcceptForm({ token }: { token: string }) {
  const action = acceptInviteAction.bind(null, token);
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="name">Votre nom</Label><Input id="name" name="name" required autoComplete="name" /></div>
      <div className="space-y-1.5"><Label htmlFor="password">Mot de passe</Label><Input id="password" name="password" type="password" required autoComplete="new-password" /></div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
