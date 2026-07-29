'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { ChipMultiSelect } from '@/components/ChipMultiSelect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PROPAGATION_MODE_LABELS, EVOLUTION_SPEED_LABELS } from '@/lib/labels';
import { setPestDisease } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestDiseaseEditor({ pest }: { pest: Pest }) {
  const [firstSymptoms, setFirstSymptoms] = useState(pest.firstSymptoms?.fr ?? '');
  const [advancedSymptoms, setAdvancedSymptoms] = useState(pest.advancedSymptoms?.fr ?? '');
  const [confusionRisk, setConfusionRisk] = useState(pest.confusionRisk?.fr ?? '');
  const [pathogen, setPathogen] = useState(pest.pathogen?.fr ?? '');
  const [propagation, setPropagation] = useState<string[]>(pest.propagationModes ?? []);
  const [potentialLosses, setPotentialLosses] = useState(pest.potentialLosses?.fr ?? '');
  const [evolutionSpeed, setEvolutionSpeed] = useState(pest.evolutionSpeed ?? '');

  return (
    <EditorShell label="Modifier les traits maladie">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>Agent pathogène</Label><textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={pathogen} onChange={(e) => setPathogen(e.target.value)} /></div>
          <div className="space-y-1"><Label>Mode de propagation</Label><ChipMultiSelect options={PROPAGATION_MODE_LABELS} value={propagation} onChange={setPropagation} /></div>
          <div className="space-y-1"><Label>Premiers symptômes</Label><textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={firstSymptoms} onChange={(e) => setFirstSymptoms(e.target.value)} /></div>
          <div className="space-y-1"><Label>Symptômes avancés</Label><textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={advancedSymptoms} onChange={(e) => setAdvancedSymptoms(e.target.value)} /></div>
          <div className="space-y-1"><Label>Risque de confusion</Label><textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={confusionRisk} onChange={(e) => setConfusionRisk(e.target.value)} /></div>
          <div className="space-y-1"><Label>Pertes potentielles</Label><textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={potentialLosses} onChange={(e) => setPotentialLosses(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Vitesse d&apos;évolution</Label>
            <Select value={evolutionSpeed} onValueChange={setEvolutionSpeed}>
              <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(EVOLUTION_SPEED_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestDisease(pest.id, {
                firstSymptoms: firstSymptoms ? { fr: firstSymptoms } : undefined,
                advancedSymptoms: advancedSymptoms ? { fr: advancedSymptoms } : undefined,
                confusionRisk: confusionRisk ? { fr: confusionRisk } : undefined,
                pathogen: pathogen ? { fr: pathogen } : undefined,
                propagationModes: propagation,
                potentialLosses: potentialLosses ? { fr: potentialLosses } : undefined,
                evolutionSpeed: evolutionSpeed || undefined,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
