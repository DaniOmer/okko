'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PEST_TYPE_LABELS } from '@/lib/labels';
import { updatePest, deletePest } from '@/lib/api';

export function PestRowActions({ pest }: { pest: { id: string; name: string; type: string; scientificName?: string } }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [name, setName] = useState(pest.name);
  const [type, setType] = useState(pest.type);
  const [scientificName, setScientificName] = useState(pest.scientificName ?? '');
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
          <DialogHeader><DialogTitle>Modifier le ravageur</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="p-name">Nom (fr) *</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1">
              <Label htmlFor="p-type">Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PEST_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label htmlFor="p-sci">Nom scientifique</Label><Input id="p-sci" value={scientificName} onChange={(e) => setScientificName(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => run(() => updatePest(pest.id, { name: { fr: name }, type, scientificName: scientificName || undefined }), () => setEditOpen(false))}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delOpen} onOpenChange={(o) => { setDelOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Supprimer</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer le ravageur &laquo;&nbsp;{pest.name}&nbsp;&raquo; ?</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-sm text-muted-foreground">Cette action est définitive.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => run(() => deletePest(pest.id), () => setDelOpen(false))}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
