'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { ChipMultiSelect } from '@/components/ChipMultiSelect';
import { MinMaxRangeInput, type MinMax } from '@/components/MinMaxRangeInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { REPRODUCTION_MODE_LABELS, DISSEMINATION_LABELS } from '@/lib/labels';
import { setPestWeed } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestWeedEditor({ pest }: { pest: Pest }) {
  const [reproduction, setReproduction] = useState<string[]>(pest.reproductionMode ?? []);
  const [dissemination, setDissemination] = useState(pest.disseminationCapacity ?? '');
  const [emergenceDepth, setEmergenceDepth] = useState<MinMax | undefined>(pest.emergenceDepth);
  const [seedBank, setSeedBank] = useState<MinMax | undefined>(pest.seedBankLongevity);

  return (
    <EditorShell label="Modifier les traits adventice">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>Mode de reproduction</Label><ChipMultiSelect options={REPRODUCTION_MODE_LABELS} value={reproduction} onChange={setReproduction} /></div>
          <div className="space-y-1">
            <Label>Capacité de dissémination</Label>
            <Select value={dissemination} onValueChange={setDissemination}>
              <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(DISSEMINATION_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <MinMaxRangeInput label="Profondeur de levée" unit="cm" value={emergenceDepth} onChange={setEmergenceDepth} />
          <MinMaxRangeInput label="Longévité de la banque de graines" unit="ans" value={seedBank} onChange={setSeedBank} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestWeed(pest.id, {
                reproductionMode: reproduction,
                disseminationCapacity: dissemination || undefined,
                emergenceDepth,
                seedBankLongevity: seedBank,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
