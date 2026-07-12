'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { NUTRITION_BASIS_LABELS, stageWithRange } from '@/lib/labels';
import { setNutrition } from '../../../../lib/api';
import type { NutrientRequirement } from '../../../../lib/api';

export function NutritionEditor({ cropId, current, phenology, editIndex }: { cropId: string; current: NutrientRequirement[]; phenology: { name: Record<string, string>; startDay: number; endDay: number }[]; editIndex?: number }) {
  const editing = editIndex != null;
  const [nutrient, setNutrient] = useState(current[editIndex!]?.nutrient ?? '');
  const [amount, setAmount] = useState(String(current[editIndex!]?.amount ?? ''));
  const [unit, setUnit] = useState(current[editIndex!]?.unit ?? 'kg/ha');
  const [basis, setBasis] = useState(current[editIndex!]?.basis ?? 'PER_HECTARE');
  const [stage, setStage] = useState(current[editIndex!]?.stage ?? '');
  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter un besoin nutritif'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nouvelItem = { nutrient, amount: Number(amount), unit, basis, stage: stage || undefined };
            const next = editing
              ? current.map((it, i) => i === editIndex ? nouvelItem : it)
              : [...current, nouvelItem];
            submit(async () => {
              await setNutrition(cropId, next);
              if (!editing) {
                setNutrient(''); setAmount(''); setUnit('kg/ha'); setBasis('PER_HECTARE'); setStage('');
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Élément &amp; quantité</Label>
            <div className="flex gap-1">
              <Input className="w-20" placeholder="N / P2O5…" value={nutrient} onChange={(e) => setNutrient(e.target.value)} required />
              <Input className="w-20" placeholder="quantité" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              <Input className="w-20" placeholder="unité" value={unit} onChange={(e) => setUnit(e.target.value)} />
              <Select value={basis} onValueChange={setBasis}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(NUTRITION_BASIS_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Stade (optionnel)</Label>
            <Select value={stage || 'NONE'} onValueChange={(v) => setStage(v === 'NONE' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Aucun / général</SelectItem>
                {phenology.map((p) => <SelectItem key={p.name.fr} value={p.name.fr}>{stageWithRange(p.name.fr, phenology)}</SelectItem>)}
              </SelectContent>
            </Select>
            {phenology.length === 0 && <p className="text-xs text-muted-foreground">Définissez la phénologie pour cibler un stade.</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
