'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
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
            <select className="border p-1" value={level} onChange={(e)=>setLevel(e.target.value)}>{LEVELS.map((l)=><option key={l} value={l}>{l}</option>)}</select>
            <input className="w-16 border p-1" placeholder="min" value={min} onChange={(e)=>setMin(e.target.value)} required />
            <input className="w-16 border p-1" placeholder="moyen" value={avg} onChange={(e)=>setAvg(e.target.value)} required />
            <input className="w-16 border p-1" placeholder="potentiel" value={pot} onChange={(e)=>setPot(e.target.value)} required />
            <input className="w-16 border p-1" placeholder="unité" value={unit} onChange={(e)=>setUnit(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
