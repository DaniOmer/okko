'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { MinMaxRangeInput, type MinMax } from '@/components/MinMaxRangeInput';
import { MonthMultiSelect } from '@/components/MonthMultiSelect';
import { DevelopmentStagesEditor, type DevStage } from '@/components/DevelopmentStagesEditor';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { setPestBiology } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestBiologyEditor({ pest }: { pest: Pest }) {
  const [lifeCycle, setLifeCycle] = useState(pest.lifeCycle?.fr ?? '');
  const [cycleDuration, setCycleDuration] = useState<MinMax | undefined>(pest.cycleDurationDays);
  const [stages, setStages] = useState<DevStage[]>(pest.developmentStages ?? []);
  const [generations, setGenerations] = useState<MinMax | undefined>(pest.generationsPerYear);
  const [months, setMonths] = useState<string[]>(pest.activityPeriods ?? []);
  const [temperature, setTemperature] = useState<MinMax | undefined>(pest.favorableConditions?.temperature);
  const [humidity, setHumidity] = useState<MinMax | undefined>(pest.favorableConditions?.humidity);
  const [rainfall, setRainfall] = useState<MinMax | undefined>(pest.favorableConditions?.rainfall);
  const [condNotes, setCondNotes] = useState(pest.favorableConditions?.notes?.fr ?? '');

  return (
    <EditorShell label="Modifier la biologie">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label>Cycle de vie</Label>
            <textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={lifeCycle} onChange={(e) => setLifeCycle(e.target.value)} />
          </div>
          <MinMaxRangeInput label="Durée du cycle" unit="j" value={cycleDuration} onChange={setCycleDuration} />
          <div className="space-y-1"><Label>Stades de développement</Label><DevelopmentStagesEditor value={stages} onChange={setStages} /></div>
          <MinMaxRangeInput label="Générations par an" value={generations} onChange={setGenerations} />
          <div className="space-y-1"><Label>Périodes d&apos;activité</Label><MonthMultiSelect value={months} onChange={setMonths} /></div>
          <div className="space-y-2 rounded-md border p-2">
            <p className="text-sm font-medium">Conditions favorables</p>
            <MinMaxRangeInput label="Température" unit="°C" value={temperature} onChange={setTemperature} />
            <MinMaxRangeInput label="Humidité" unit="%" value={humidity} onChange={setHumidity} />
            <MinMaxRangeInput label="Pluie" unit="mm" value={rainfall} onChange={setRainfall} />
            <div className="space-y-1">
              <Label>Note</Label>
              <textarea className="min-h-12 w-full rounded-md border px-3 py-2 text-sm" value={condNotes} onChange={(e) => setCondNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestBiology(pest.id, {
                lifeCycle: lifeCycle ? { fr: lifeCycle } : undefined,
                cycleDurationDays: cycleDuration,
                developmentStages: stages.filter((s) => (s.name.fr ?? '').trim() !== ''),
                generationsPerYear: generations,
                activityPeriods: months,
                favorableConditions: (temperature || humidity || rainfall || condNotes)
                  ? { temperature, humidity, rainfall, notes: condNotes ? { fr: condNotes } : undefined }
                  : undefined,
              });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
