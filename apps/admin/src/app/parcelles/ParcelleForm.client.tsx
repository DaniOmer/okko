'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createParcel } from '@/lib/suivi-actions';
import { ParcelleFields, emptyParcelle, parcelleToPayload, type ParcelleFormValue } from './ParcelleForm';
import type { Beneficiary, Zone } from '@/lib/api';

export function ParcelleCreate({ beneficiaries, zones }: { beneficiaries: Beneficiary[]; zones: Zone[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ParcelleFormValue>(emptyParcelle());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try { await createParcel(parcelleToPayload(form)); setOpen(false); setForm(emptyParcelle()); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild><Button>Nouvelle parcelle</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle parcelle</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <ParcelleFields value={form} onChange={setForm} beneficiaries={beneficiaries} zones={zones} />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" disabled={busy} onClick={submit}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
