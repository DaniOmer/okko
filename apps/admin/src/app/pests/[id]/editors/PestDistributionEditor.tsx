'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { TagListInput } from '@/components/TagListInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { setPestDistribution } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestDistributionEditor({ pest }: { pest: Pest }) {
  const [areas, setAreas] = useState<string[]>(pest.geographicAreas ?? []);
  const [climate, setClimate] = useState(pest.favorableClimate?.fr ?? '');
  const [presence, setPresence] = useState(pest.knownPresence?.fr ?? '');

  return (
    <EditorShell label="Modifier la répartition">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>Zones géographiques</Label><TagListInput value={areas} onChange={setAreas} placeholder="ex. Afrique de l'Ouest" /></div>
          <div className="space-y-1">
            <Label>Climat favorable</Label>
            <textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={climate} onChange={(e) => setClimate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Présence connue</Label>
            <textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={presence} onChange={(e) => setPresence(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestDistribution(pest.id, {
                geographicAreas: areas,
                favorableClimate: climate ? { fr: climate } : undefined,
                knownPresence: presence ? { fr: presence } : undefined,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
