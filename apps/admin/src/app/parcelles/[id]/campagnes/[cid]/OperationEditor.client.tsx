'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createOperation, updateOperation } from '@/lib/suivi-actions';
import { OperationFields, emptyOperation, operationToPayload, type OperationFormValue } from './OperationForm';
import type { OperationLog } from '@/lib/api';

export function OperationEditor({ campaignId, initial, trigger, parcelGps }: { campaignId: string; initial?: OperationLog; trigger: React.ReactNode; parcelGps?: { lat?: number; lng?: number } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<OperationFormValue>(initial
    ? { type: initial.type, date: initial.date, inputs: initial.inputs, laborCost: initial.laborCost != null ? String(initial.laborCost) : '', notes: initial.notes ?? '', photos: initial.photos ?? [], lat: initial.gpsLat != null ? String(initial.gpsLat) : '', lng: initial.gpsLng != null ? String(initial.gpsLng) : '' }
    : { ...emptyOperation(), lat: parcelGps?.lat != null ? String(parcelGps.lat) : '', lng: parcelGps?.lng != null ? String(parcelGps.lng) : '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try {
      if (initial) await updateOperation(initial.id, operationToPayload(form));
      else await createOperation({ campaignId, ...operationToPayload(form) });
      setOpen(false); if (!initial) setForm(emptyOperation()); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Modifier l’opération" : 'Nouvelle opération'}</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <OperationFields value={form} onChange={setForm} />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" disabled={busy} onClick={submit}>{initial ? 'Enregistrer' : 'Ajouter'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
