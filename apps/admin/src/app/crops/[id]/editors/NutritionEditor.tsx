'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { setNutrition } from '../../../../lib/api';
import type { NutrientRequirement } from '../../../../lib/api';

const BASES = ['PER_HECTARE', 'PER_TONNE'];

export function NutritionEditor({ cropId, current }: { cropId: string; current: NutrientRequirement[] }) {
  const [nutrient, setNutrient] = useState(''); const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('kg/ha'); const [basis, setBasis] = useState(BASES[0]); const [stage, setStage] = useState('');
  return (
    <EditorShell label="+ Ajouter un besoin nutritif">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = [...current, { nutrient, amount: Number(amount), unit, basis, stage: stage || undefined }];
            submit(() => setNutrition(cropId, next));
          }}
          className="space-y-2 text-sm"
        >
          <div className="flex gap-1">
            <Input className="w-20" placeholder="N / P2O5…" value={nutrient} onChange={(e) => setNutrient(e.target.value)} required />
            <Input className="w-20" placeholder="quantité" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <Input className="w-20" placeholder="unité" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <Select value={basis} onValueChange={setBasis}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BASES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="stade (optionnel)" value={stage} onChange={(e) => setStage(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Ajouter</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
