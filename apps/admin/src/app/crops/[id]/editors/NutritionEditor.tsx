'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
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
            <input className="w-20 border p-1" placeholder="N / P2O5…" value={nutrient} onChange={(e)=>setNutrient(e.target.value)} required />
            <input className="w-20 border p-1" placeholder="quantité" value={amount} onChange={(e)=>setAmount(e.target.value)} required />
            <input className="w-20 border p-1" placeholder="unité" value={unit} onChange={(e)=>setUnit(e.target.value)} />
            <select className="border p-1" value={basis} onChange={(e)=>setBasis(e.target.value)}>{BASES.map((b)=><option key={b} value={b}>{b}</option>)}</select>
          </div>
          <input className="w-full border p-1" placeholder="stade (optionnel)" value={stage} onChange={(e)=>setStage(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
