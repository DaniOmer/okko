'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { setRequirements } from '../../../../lib/api';

const n = (v: string): number => Number(v);

export function RequirementsEditor({ cropId }: { cropId: string }) {
  const [tMin, setTMin] = useState(''); const [tOpt, setTOpt] = useState(''); const [tMax, setTMax] = useState('');
  const [rMin, setRMin] = useState(''); const [rOpt, setROpt] = useState(''); const [rMax, setRMax] = useState('');
  const [phMin, setPhMin] = useState(''); const [phOpt, setPhOpt] = useState(''); const [phMax, setPhMax] = useState('');
  const [texture, setTexture] = useState('');

  return (
    <EditorShell label="Éditer les exigences climat/sol">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const body: Parameters<typeof setRequirements>[1] = {};
            if (tMin && tOpt && tMax) body.climatic = { ...(body.climatic ?? {}), temperature: { min: n(tMin), optimal: n(tOpt), max: n(tMax), unit: '°C' } };
            if (rMin && rOpt && rMax) body.climatic = { ...(body.climatic ?? {}), rainfall: { min: n(rMin), optimal: n(rOpt), max: n(rMax), unit: 'mm' } };
            if (phMin && phOpt && phMax) body.edaphic = { ...(body.edaphic ?? {}), ph: { min: n(phMin), optimal: n(phOpt), max: n(phMax), unit: 'pH' } };
            if (texture) body.edaphic = { ...(body.edaphic ?? {}), texture };
            submit(() => setRequirements(cropId, body));
          }}
          className="space-y-2 text-sm"
        >
          <fieldset className="flex gap-1 items-center"><span className="w-24">Température</span>
            <input className="w-16 border p-1" placeholder="min" value={tMin} onChange={(e)=>setTMin(e.target.value)} />
            <input className="w-16 border p-1" placeholder="opt" value={tOpt} onChange={(e)=>setTOpt(e.target.value)} />
            <input className="w-16 border p-1" placeholder="max" value={tMax} onChange={(e)=>setTMax(e.target.value)} /><span>°C</span>
          </fieldset>
          <fieldset className="flex gap-1 items-center"><span className="w-24">Pluviométrie</span>
            <input className="w-16 border p-1" placeholder="min" value={rMin} onChange={(e)=>setRMin(e.target.value)} />
            <input className="w-16 border p-1" placeholder="opt" value={rOpt} onChange={(e)=>setROpt(e.target.value)} />
            <input className="w-16 border p-1" placeholder="max" value={rMax} onChange={(e)=>setRMax(e.target.value)} /><span>mm</span>
          </fieldset>
          <fieldset className="flex gap-1 items-center"><span className="w-24">pH du sol</span>
            <input className="w-16 border p-1" placeholder="min" value={phMin} onChange={(e)=>setPhMin(e.target.value)} />
            <input className="w-16 border p-1" placeholder="opt" value={phOpt} onChange={(e)=>setPhOpt(e.target.value)} />
            <input className="w-16 border p-1" placeholder="max" value={phMax} onChange={(e)=>setPhMax(e.target.value)} />
          </fieldset>
          <fieldset className="flex gap-1 items-center"><span className="w-24">Texture</span>
            <input className="flex-1 border p-1" placeholder="ex. limono-sableux" value={texture} onChange={(e)=>setTexture(e.target.value)} />
          </fieldset>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Enregistrer</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
