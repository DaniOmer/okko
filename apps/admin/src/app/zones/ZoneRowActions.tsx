'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateZone, deleteZone } from '@/lib/actions';

export function ZoneRowActions({ zone }: { zone: { id: string; name: string; country: string; koppen?: string } }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [name, setName] = useState(zone.name);
  const [country, setCountry] = useState(zone.country);
  const [koppen, setKoppen] = useState(zone.koppen ?? '');
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
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="z-name">Nom (fr) *</Label><Input id="z-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="z-country">Pays *</Label><Input id="z-country" value={country} onChange={(e) => setCountry(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="z-koppen">Köppen</Label><Input id="z-koppen" value={koppen} onChange={(e) => setKoppen(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => run(() => updateZone(zone.id, { name: { fr: name }, country, koppen: koppen || undefined }), () => setEditOpen(false))}>Enregistrer</Button>
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
