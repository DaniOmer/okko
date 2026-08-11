'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createCampaign, updateCampaign } from '@/lib/suivi-actions';
import { fetchCropVarieties, fetchCropWindows } from './varieties-action';
import { CampaignFields, emptyCampaign, campaignToPayload, type CampaignFormValue } from './CampaignForm';
import type { CropDocument, Variety, CroppingWindow, Campaign } from '@/lib/api';

export function CampaignEditor({ parcelId, crops, initial, trigger }: {
  parcelId: string; crops: CropDocument[]; initial?: Campaign; trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignFormValue>(initial
    ? { cropId: initial.cropId ?? '', customCropName: initial.customCropName ?? '', windowId: initial.windowId ?? '', varietyId: initial.varietyId ?? '', season: initial.season, startDate: initial.startDate ?? '', status: initial.status, notes: initial.notes ?? '' }
    : emptyCampaign());
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [windows, setWindows] = useState<CroppingWindow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!form.cropId) { setVarieties([]); setWindows([]); return; }
    fetchCropVarieties(form.cropId).then(setVarieties).catch(() => setVarieties([]));
    fetchCropWindows(form.cropId).then(setWindows).catch(() => setWindows([]));
  }, [form.cropId]);

  async function submit() {
    setBusy(true); setError(null);
    try {
      if (initial) await updateCampaign(initial.id, campaignToPayload(form));
      else await createCampaign({ parcelId, ...campaignToPayload(form) });
      setOpen(false); if (!initial) setForm(emptyCampaign()); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? 'Modifier la campagne' : 'Nouvelle campagne'}</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <CampaignFields value={form} onChange={setForm} crops={crops} varieties={varieties} windows={windows} />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" disabled={busy} onClick={submit}>{initial ? 'Enregistrer' : 'Créer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
