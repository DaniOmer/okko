'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
          <Input className="w-full" placeholder="Nom du stade (ex. Levée)" value={name} onChange={(e)=>setName(e.target.value)} required />
          <div className="flex gap-1 items-center">
            <Input className="w-20" placeholder="jour début" value={start} onChange={(e)=>setStart(e.target.value)} required />
            <Input className="w-20" placeholder="jour fin" value={end} onChange={(e)=>setEnd(e.target.value)} required />
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
