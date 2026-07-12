'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SUSCEPTIBILITY_LABELS, stageWithRange } from '@/lib/labels';
import { setPestControl } from '../../../../lib/api';

interface ControlMethod { category: string; description: Record<string, string>; inputs: string[]; }
interface PestInitial {
  pestId: string;
  susceptibility: string;
  threshold?: string;
  sensitiveStages: string[];
  controlMethods: ControlMethod[];
}

export function PestControlEditor({
  cropId,
  pests,
  initial,
  phenology,
}: {
  cropId: string;
  pests: { id: string; name: string }[];
  initial?: PestInitial;
  phenology: { name: Record<string, string>; startDay: number; endDay: number }[];
}) {
  const editing = !!initial;
  const [pestId, setPestId] = useState(initial?.pestId ?? '');
  const [susceptibility, setSusceptibility] = useState(initial?.susceptibility ?? 'MEDIUM');
  const [threshold, setThreshold] = useState(initial?.threshold ?? '');
  const [stages, setStages] = useState<string[]>(initial?.sensitiveStages ?? []);
  if (pests.length === 0) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord un <a href="/pests" className="underline">ravageur</a> pour le rattacher.</p>;
  }
  return (
    <EditorShell label={editing ? 'Modifier' : '+ Rattacher un ravageur / une maladie'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pestId) return;
            submit(async () => {
              await setPestControl(cropId, pestId, {
                susceptibility,
                threshold: threshold || undefined,
                sensitiveStages: stages.length ? stages : undefined,
                ...(editing ? { controlMethods: initial!.controlMethods } : {}),
              });
              if (!editing) {
                setPestId(''); setSusceptibility('MEDIUM'); setThreshold(''); setStages([]);
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Ravageur / maladie *</Label>
            <Select value={pestId} onValueChange={setPestId} disabled={editing}>
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
            {phenology.length === 0
              ? <p className="text-xs text-muted-foreground">Définissez la phénologie pour cibler des stades sensibles.</p>
              : phenology.map((p) => {
                  const nm = p.name.fr;
                  return (
                    <label key={nm} className="flex gap-2 items-center">
                      <input type="checkbox" checked={stages.includes(nm)} onChange={(e) => setStages(e.target.checked ? [...stages, nm] : stages.filter((x) => x !== nm))} />
                      {stageWithRange(nm, phenology)}
                    </label>
                  );
                })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>{editing ? 'Enregistrer' : 'Rattacher'}</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
