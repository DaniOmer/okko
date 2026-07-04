'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { setZoneSuitability } from '../../../../lib/api';

const RATINGS = ['SUITABLE', 'MARGINAL', 'UNSUITABLE'];

export function ZoneSuitabilityEditor({ cropId, zones }: { cropId: string; zones: { id: string; name: string }[] }) {
  const [zoneId, setZoneId] = useState(''); const [rating, setRating] = useState(RATINGS[0]); const [justification, setJustification] = useState('');
  if (zones.length === 0) {
    return <p className="text-sm text-gray-500">Créez d&apos;abord une <a href="/zones" className="underline">zone</a> pour la rattacher.</p>;
  }
  return (
    <EditorShell label="+ Rattacher une zone">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(() => setZoneSuitability(cropId, zoneId, { rating, justification: justification || undefined })); }}
          className="space-y-2 text-sm"
        >
          <select className="w-full border p-1" value={zoneId} onChange={(e)=>setZoneId(e.target.value)} required>
            <option value="">— Zone —</option>
            {zones.map((z)=><option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <select className="w-full border p-1" value={rating} onChange={(e)=>setRating(e.target.value)}>{RATINGS.map((r)=><option key={r} value={r}>{r}</option>)}</select>
          <input className="w-full border p-1" placeholder="justification (optionnel)" value={justification} onChange={(e)=>setJustification(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Rattacher</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
