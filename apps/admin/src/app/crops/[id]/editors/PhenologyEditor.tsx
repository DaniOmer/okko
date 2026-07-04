'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { setPhenology } from '../../../../lib/api';
import type { PhenologicalStage } from '../../../../lib/api';

export function PhenologyEditor({ cropId, current }: { cropId: string; current: PhenologicalStage[] }) {
  const [name, setName] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  return (
    <EditorShell label="+ Ajouter un stade phénologique">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = [...current, { name: { fr: name }, startDay: Number(start), endDay: Number(end), order: current.length + 1 }];
            submit(() => setPhenology(cropId, next));
          }}
          className="space-y-2 text-sm"
        >
          <input className="w-full border p-1" placeholder="Nom du stade (ex. Levée)" value={name} onChange={(e)=>setName(e.target.value)} required />
          <div className="flex gap-1 items-center">
            <input className="w-20 border p-1" placeholder="jour début" value={start} onChange={(e)=>setStart(e.target.value)} required />
            <input className="w-20 border p-1" placeholder="jour fin" value={end} onChange={(e)=>setEnd(e.target.value)} required />
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
