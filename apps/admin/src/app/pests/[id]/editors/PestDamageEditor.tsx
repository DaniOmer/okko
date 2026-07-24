'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { ChipMultiSelect } from '@/components/ChipMultiSelect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ATTACKED_ORGAN_LABELS, DAMAGE_TYPE_LABELS, HARMFULNESS_LABELS } from '@/lib/labels';
import { setPestDamage } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestDamageEditor({ pest }: { pest: Pest }) {
  const [symptoms, setSymptoms] = useState(pest.symptoms?.fr ?? '');
  const [organs, setOrgans] = useState<string[]>(pest.attackedOrgans ?? []);
  const [types, setTypes] = useState<string[]>(pest.damageTypes ?? []);
  const [harmfulness, setHarmfulness] = useState(pest.harmfulnessLevel ?? '');

  return (
    <EditorShell label="Modifier les dégâts">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>Organes attaqués</Label><ChipMultiSelect options={ATTACKED_ORGAN_LABELS} value={organs} onChange={setOrgans} /></div>
          <div className="space-y-1"><Label>Types de dégâts</Label><ChipMultiSelect options={DAMAGE_TYPE_LABELS} value={types} onChange={setTypes} /></div>
          <div className="space-y-1">
            <Label>Niveau de nuisibilité</Label>
            <Select value={harmfulness} onValueChange={setHarmfulness}>
              <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(HARMFULNESS_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Symptômes caractéristiques</Label>
            <textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestDamage(pest.id, {
                symptoms: symptoms ? { fr: symptoms } : undefined,
                attackedOrgans: organs,
                damageTypes: types,
                harmfulnessLevel: harmfulness || undefined,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
