'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { INPUT_LEVEL_LABELS } from '@/lib/labels';
import { setYields } from '../../../../lib/api';
import type { YieldReference } from '../../../../lib/api';

export function YieldsEditor({ cropId, current }: { cropId: string; current: YieldReference[] }) {
  const [level, setLevel] = useState('MEDIUM');
  const [min, setMin] = useState(''); const [avg, setAvg] = useState(''); const [pot, setPot] = useState(''); const [unit, setUnit] = useState('t/ha');
  return (
    <EditorShell label="+ Ajouter un rendement de référence">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = [...current, { inputLevel: level, min: Number(min), average: Number(avg), potential: Number(pot), unit }];
            submit(async () => {
              await setYields(cropId, next);
              setLevel('MEDIUM'); setMin(''); setAvg(''); setPot(''); setUnit('t/ha');
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Niveau d&apos;intrants</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INPUT_LEVEL_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Rendement (min · moyen · potentiel) et unité</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={min} onChange={(e) => setMin(e.target.value)} required />
              <Input className="w-16" placeholder="moyen" value={avg} onChange={(e) => setAvg(e.target.value)} required />
              <Input className="w-16" placeholder="potentiel" value={pot} onChange={(e) => setPot(e.target.value)} required />
              <Input className="w-20" placeholder="unité" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Ajouter</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
