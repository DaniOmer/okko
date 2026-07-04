'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { setPestControl } from '../../../../lib/api';

const LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

export function PestControlEditor({ cropId, pests }: { cropId: string; pests: { id: string; name: string }[] }) {
  const [pestId, setPestId] = useState(''); const [susceptibility, setSusceptibility] = useState(LEVELS[1]);
  const [threshold, setThreshold] = useState(''); const [stages, setStages] = useState('');
  if (pests.length === 0) {
    return <p className="text-sm text-gray-500">Créez d&apos;abord un <a href="/pests" className="underline">ravageur</a> pour le rattacher.</p>;
  }
  return (
    <EditorShell label="+ Rattacher un ravageur / une maladie">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => setPestControl(cropId, pestId, {
              susceptibility,
              threshold: threshold || undefined,
              sensitiveStages: stages ? stages.split(',').map((s)=>s.trim()).filter(Boolean) : undefined,
            }));
          }}
          className="space-y-2 text-sm"
        >
          <select className="w-full border p-1" value={pestId} onChange={(e)=>setPestId(e.target.value)} required>
            <option value="">— Ravageur / maladie —</option>
            {pests.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="w-full border p-1" value={susceptibility} onChange={(e)=>setSusceptibility(e.target.value)}>{LEVELS.map((l)=><option key={l} value={l}>{l}</option>)}</select>
          <input className="w-full border p-1" placeholder="seuil de nuisibilité (optionnel)" value={threshold} onChange={(e)=>setThreshold(e.target.value)} />
          <input className="w-full border p-1" placeholder="stades sensibles (virgules, optionnel)" value={stages} onChange={(e)=>setStages(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Rattacher</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
