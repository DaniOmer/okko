'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteCampaign } from '@/lib/suivi-actions';
import { CampaignEditor } from './CampaignForm.client';
import type { Campaign, CropDocument } from '@/lib/api';

export function CampaignRowActions({ campaign, crops }: { campaign: Campaign; crops: CropDocument[] }) {
  const router = useRouter();
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function del() {
    setBusy(true); setError(null);
    try { await deleteCampaign(campaign.id); setDelOpen(false); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <div className="flex justify-end gap-2">
      <CampaignEditor parcelId={campaign.parcelId} crops={crops} initial={campaign}
        trigger={<Button variant="outline" size="sm">Modifier</Button>} />
      <Dialog open={delOpen} onOpenChange={(o) => { setDelOpen(o); if (!o) setError(null); }}>
        <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Supprimer</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer cette campagne ?</DialogTitle></DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-sm text-muted-foreground">Supprime aussi son journal. Définitif.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={del}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
