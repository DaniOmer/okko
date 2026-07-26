'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { TagListInput } from '@/components/TagListInput';
import { ApprovedProductsEditor, type ApprovedProductRow } from '@/components/ApprovedProductsEditor';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { setPestManagement } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestManagementEditor({ pest }: { pest: Pest }) {
  const isWeed = pest.kind === 'WEED';
  const [prevention, setPrevention] = useState(pest.prevention?.fr ?? '');
  const [biologicalControl, setBiologicalControl] = useState(pest.biologicalControl?.fr ?? '');
  const [predators, setPredators] = useState<string[]>(pest.predators ?? []);
  const [parasitoids, setParasitoids] = useState<string[]>(pest.parasitoids ?? []);
  const [products, setProducts] = useState<ApprovedProductRow[]>(pest.approvedProducts ?? []);
  const [knownResistances, setKnownResistances] = useState(pest.knownResistances?.fr ?? '');

  return (
    <EditorShell label="Modifier la gestion">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>Prévention</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={prevention} onChange={(e) => setPrevention(e.target.value)} /></div>
          <div className="space-y-1"><Label>Lutte biologique</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={biologicalControl} onChange={(e) => setBiologicalControl(e.target.value)} /></div>
          {!isWeed && (<>
            <div className="space-y-1"><Label>Prédateurs naturels</Label><TagListInput value={predators} onChange={setPredators} placeholder="ex. Coccinelle" /></div>
            <div className="space-y-1"><Label>Parasitoïdes</Label><TagListInput value={parasitoids} onChange={setParasitoids} placeholder="ex. Trichogramma" /></div>
          </>)}
          <div className="space-y-1"><Label>Produits homologués <span className="font-normal text-muted-foreground">(selon le pays)</span></Label><ApprovedProductsEditor value={products} onChange={setProducts} /></div>
          <div className="space-y-1"><Label>Résistances connues</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={knownResistances} onChange={(e) => setKnownResistances(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestManagement(pest.id, {
                prevention: prevention ? { fr: prevention } : undefined,
                biologicalControl: biologicalControl ? { fr: biologicalControl } : undefined,
                predators: isWeed ? undefined : predators,
                parasitoids: isWeed ? undefined : parasitoids,
                approvedProducts: products.filter((p) => p.name.trim() !== ''),
                knownResistances: knownResistances ? { fr: knownResistances } : undefined,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
