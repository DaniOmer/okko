'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateParcel, deleteParcel } from '@/lib/suivi-actions';
import { ParcelleFields, parcelleToPayload, type ParcelleFormValue } from './ParcelleForm';
import type { Parcel, Beneficiary, Zone } from '@/lib/api';

export function ParcelleRowActions({ p, beneficiaries, zones }: { p: Parcel; beneficiaries: Beneficiary[]; zones: Zone[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [form, setForm] = useState<ParcelleFormValue>({
    name: p.name, beneficiaryId: p.beneficiaryId ?? '', zoneId: p.zoneId ?? '',
    gpsLat: p.gpsLat != null ? String(p.gpsLat) : '', gpsLng: p.gpsLng != null ? String(p.gpsLng) : '',
    locality: p.locality ?? '', areaHectares: p.areaHectares != null ? String(p.areaHectares) : '', notes: p.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>, onOk: () => void) {
    setBusy(true); setError(null);
    try { await fn(); onOk(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <div className="flex justify-end gap-2">
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="outline" size="sm">Modifier</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la parcelle</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <ParcelleFields value={form} onChange={setForm} beneficiaries={beneficiaries} zones={zones} />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => run(() => updateParcel(p.id, parcelleToPayload(form)), () => setEditOpen(false))}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={delOpen} onOpenChange={(o) => { setDelOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Supprimer</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer «&nbsp;{p.name}&nbsp;» ?</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-sm text-muted-foreground">Cette action est définitive.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => run(() => deleteParcel(p.id), () => setDelOpen(false))}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
