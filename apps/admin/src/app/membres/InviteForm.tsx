'use client';
import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { inviteAction, type InviteState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Envoi…' : 'Inviter'}</Button>;
}

export function InviteForm({ roleOptions }: { roleOptions: { value: string; label: string }[] }) {
  const [state, action] = useFormState<InviteState, FormData>(inviteAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) formRef.current?.reset(); }, [state.ok]);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input name="email" type="email" placeholder="email@organisation.bj" required aria-label="Email à inviter" />
        {state.error && <p className="mt-1 text-sm text-destructive">{state.error}</p>}
        {state.ok && (
          <p className="mt-1 text-sm text-muted-foreground">
            {state.emailSent ? 'Invitation envoyée par email.' : 'Invitation créée (email non envoyé — vérifiez la config Brevo).'}
          </p>
        )}
      </div>
      <select name="role" required aria-label="Rôle" defaultValue={roleOptions[0]?.value} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <SubmitButton />
    </form>
  );
}
