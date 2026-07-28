'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function DeleteWithConfirm({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" disabled={disabled}
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}>Supprimer</Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Supprimer définitivement ?</span>
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setConfirming(false)}>Annuler</Button>
      <Button type="button" variant="destructive" size="sm" disabled={disabled} onClick={onConfirm}>Supprimer</Button>
    </div>
  );
}
