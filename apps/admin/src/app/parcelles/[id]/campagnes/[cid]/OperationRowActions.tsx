'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteOperation } from '@/lib/suivi-actions';
import { OperationEditor } from './OperationEditor.client';
import type { OperationLog } from '@/lib/api';

export function OperationRowActions({ op }: { op: OperationLog }) {
  const router = useRouter();
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function del() {
    setBusy(true);
    try { await deleteOperation(op.id); setDelOpen(false); router.refresh(); } finally { setBusy(false); }
  }
  return (
    <div className="flex gap-2">
      <OperationEditor campaignId={op.campaignId} initial={op} trigger={<Button variant="outline" size="sm">Modifier</Button>} />
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Supprimer</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer cette opération ?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDelOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={del}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
