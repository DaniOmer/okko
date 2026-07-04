'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { setYields } from '../../../../lib/api';
import type { YieldReference } from '../../../../lib/api';

const LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

export function YieldsEditor({ cropId, current }: { cropId: string; current: YieldReference[] }) {
  const [level, setLevel] = useState(LEVELS[1]);
  const [min, setMin] = useState(''); const [avg, setAvg] = useState(''); const [pot, setPot] = useState(''); const [unit, setUnit] = useState('t/ha');
  return (
    <EditorShell label="+ Ajouter un rendement de référence">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = [...current, { inputLevel: level, min: Number(min), average: Number(avg), potential: Number(pot), unit }];
            submit(() => setYields(cropId, next));
          }}
          className="space-y-2 text-sm"
        >
          <div className="flex gap-1 items-center">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="w-16" placeholder="min" value={min} onChange={(e) => setMin(e.target.value)} required />
            <Input className="w-16" placeholder="moyen" value={avg} onChange={(e) => setAvg(e.target.value)} required />
            <Input className="w-16" placeholder="potentiel" value={pot} onChange={(e) => setPot(e.target.value)} required />
            <Input className="w-16" placeholder="unité" value={unit} onChange={(e) => setUnit(e.target.value)} />
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
