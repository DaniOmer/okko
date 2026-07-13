'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { inviteAction, type InviteState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Envoi…' : 'Inviter'}</Button>;
}

export function InviteForm() {
  const [state, action] = useFormState<InviteState, FormData>(inviteAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input name="email" type="email" placeholder="email@organisation.bj" required aria-label="Email à inviter" />
        {state.error && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
        {state.ok && (
          <p className="mt-1 text-sm text-muted-foreground">
            {state.emailSent ? 'Invitation envoyée par email.' : 'Invitation créée (email non envoyé — vérifiez la config Brevo).'}
          </p>
        )}
      </div>
      <SubmitButton />
    </form>
  );
}
