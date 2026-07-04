'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { addVariety } from '../../../../lib/api';

export function VarietyEditor({ cropId }: { cropId: string }) {
  const [name, setName] = useState(''); const [maturityDays, setMaturityDays] = useState(''); const [traits, setTraits] = useState('');
  return (
    <EditorShell label="+ Ajouter une variété">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => addVariety(cropId, {
              name: { fr: name },
              maturityDays: maturityDays ? Number(maturityDays) : undefined,
              traits: traits ? traits.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
            }));
          }}
          className="space-y-2 text-sm"
        >
          <input className="w-full border p-1" placeholder="Nom (fr)" value={name} onChange={(e)=>setName(e.target.value)} required />
          <input className="w-full border p-1" placeholder="Cycle (jours, optionnel)" value={maturityDays} onChange={(e)=>setMaturityDays(e.target.value)} />
          <input className="w-full border p-1" placeholder="Traits (séparés par des virgules)" value={traits} onChange={(e)=>setTraits(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
