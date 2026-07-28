'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateZone, deleteZone } from '@/lib/actions';
import { ZoneFields, zoneFormFromZone, zoneFormToPayload, type ZoneFormValue } from './ZoneFields';
import type { Zone } from '@/lib/api';

export function ZoneRowActions({ zone }: { zone: Zone }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [form, setForm] = useState<ZoneFormValue>(zoneFormFromZone(zone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, onOk: () => void) {
    setBusy(true); setError(null);
    try { await fn(); onOk(); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="outline" size="sm">Modifier</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la zone</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <ZoneFields value={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => run(() => updateZone(zone.id, zoneFormToPayload(form)), () => setEditOpen(false))}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delOpen} onOpenChange={(o) => { setDelOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Supprimer</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer la zone &laquo;&nbsp;{zone.name}&nbsp;&raquo; ?</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-sm text-muted-foreground">Cette action est définitive.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => run(() => deleteZone(zone.id), () => setDelOpen(false))}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
