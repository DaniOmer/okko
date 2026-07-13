'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { registerAction, type ActionState } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Création…' : 'Créer mon organisation'}</Button>;
}

export function RegisterForm() {
  const [state, action] = useFormState<ActionState, FormData>(registerAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="organizationName">Nom de l'organisation</Label><Input id="organizationName" name="organizationName" required /></div>
      <div className="space-y-1.5"><Label htmlFor="name">Votre nom</Label><Input id="name" name="name" required autoComplete="name" /></div>
      <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
      <div className="space-y-1.5"><Label htmlFor="password">Mot de passe</Label><Input id="password" name="password" type="password" required autoComplete="new-password" /></div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
