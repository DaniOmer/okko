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

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, formAction] = useFormState<ActionState, FormData>(acceptInviteAction.bind(null, token), {});
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" defaultValue={email} disabled /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5"><Label htmlFor="firstName">Prénom</Label><Input id="firstName" name="firstName" required autoComplete="given-name" /></div>
        <div className="space-y-1.5"><Label htmlFor="lastName">Nom</Label><Input id="lastName" name="lastName" required autoComplete="family-name" /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="password">Mot de passe</Label><Input id="password" name="password" type="password" required autoComplete="new-password" /></div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
