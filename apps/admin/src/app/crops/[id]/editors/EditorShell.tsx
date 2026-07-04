'use client';
import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-green-700 underline">
        {label}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded border p-3 bg-gray-50">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {children({ submit, close: () => setOpen(false), busy })}
    </div>
  );
}
