'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { setPestControl } from '../../../../lib/api';

const LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

export function PestControlEditor({ cropId, pests }: { cropId: string; pests: { id: string; name: string }[] }) {
  const [pestId, setPestId] = useState(''); const [susceptibility, setSusceptibility] = useState(LEVELS[1]);
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
            submit(() => setPestControl(cropId, pestId, {
              susceptibility,
              threshold: threshold || undefined,
              sensitiveStages: stages ? stages.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
            }));
          }}
          className="space-y-2 text-sm"
        >
          <Select value={pestId} onValueChange={setPestId}>
            <SelectTrigger><SelectValue placeholder="— Ravageur / maladie —" /></SelectTrigger>
            <SelectContent>
              {pests.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={susceptibility} onValueChange={setSusceptibility}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="seuil de nuisibilité (optionnel)" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          <Input placeholder="stades sensibles (virgules, optionnel)" value={stages} onChange={(e) => setStages(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Rattacher</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
