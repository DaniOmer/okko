'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createBeneficiary } from '@/lib/suivi-actions';
import { BeneficiaireFields, emptyBeneficiaire, beneficiaireToPayload, type BeneficiaireFormValue } from './BeneficiaireForm';

export function BeneficiaireCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BeneficiaireFormValue>(emptyBeneficiaire());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try { await createBeneficiary(beneficiaireToPayload(form)); setOpen(false); setForm(emptyBeneficiaire()); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild><Button>Nouveau bénéficiaire</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau bénéficiaire</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <BeneficiaireFields value={form} onChange={setForm} />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button size="sm" disabled={busy} onClick={submit}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
