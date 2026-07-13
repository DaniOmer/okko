'use client';
import { useFormStatus } from 'react-dom';
import { revokeAction } from './actions';
import { Button } from '@/components/ui/button';

function Inner() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="ghost" size="sm" disabled={pending}>{pending ? '…' : 'Révoquer'}</Button>;
}

export function RevokeButton({ id }: { id: string }) {
  return (
    <form action={revokeAction.bind(null, id)}>
      <Inner />
    </form>
  );
}
