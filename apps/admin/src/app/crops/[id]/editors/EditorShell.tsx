'use client';
import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Helpers {
  submit: (fn: () => Promise<unknown>) => Promise<void>;
  close: () => void;
  busy: boolean;
}

export function EditorShell({ label, children }: { label: string; children: (h: Helpers) => ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(fn: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {children({ submit, close: () => setOpen(false), busy })}
      </DialogContent>
    </Dialog>
  );
}
