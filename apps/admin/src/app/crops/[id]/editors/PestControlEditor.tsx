'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SUSCEPTIBILITY_LABELS } from '@/lib/labels';
import { setPestControl } from '../../../../lib/api';

export function PestControlEditor({ cropId, pests }: { cropId: string; pests: { id: string; name: string }[] }) {
  const [pestId, setPestId] = useState(''); const [susceptibility, setSusceptibility] = useState('MEDIUM');
  const [threshold, setThreshold] = useState(''); const [stages, setStages] = useState('');
  if (pests.length === 0) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord un <a href="/pests" className="underline">ravageur</a> pour le rattacher.</p>;
  }
  return (
    <EditorShell label="+ Rattacher un ravageur / une maladie">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pestId) return;
            submit(async () => {
              await setPestControl(cropId, pestId, {
                susceptibility,
                threshold: threshold || undefined,
                sensitiveStages: stages ? stages.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
              });
              setPestId(''); setSusceptibility('MEDIUM'); setThreshold(''); setStages('');
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Ravageur / maladie *</Label>
            <Select value={pestId} onValueChange={setPestId}>
              <SelectTrigger><SelectValue placeholder="— Ravageur / maladie —" /></SelectTrigger>
              <SelectContent>
                {pests.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Sensibilité</Label>
            <Select value={susceptibility} onValueChange={setSusceptibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SUSCEPTIBILITY_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Seuil de nuisibilité (optionnel)</Label>
            <Input placeholder="seuil de nuisibilité (optionnel)" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Stades sensibles (optionnel)</Label>
            <Input placeholder="stades sensibles (virgules, optionnel)" value={stages} onChange={(e) => setStages(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Rattacher</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
