'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { setRequirements } from '@/lib/actions';

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
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Température — min · optimal · max (°C)</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={tMin} onChange={(e)=>setTMin(e.target.value)} />
              <Input className="w-16" placeholder="opt" value={tOpt} onChange={(e)=>setTOpt(e.target.value)} />
              <Input className="w-16" placeholder="max" value={tMax} onChange={(e)=>setTMax(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Pluviométrie — min · optimal · max (mm)</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={rMin} onChange={(e)=>setRMin(e.target.value)} />
              <Input className="w-16" placeholder="opt" value={rOpt} onChange={(e)=>setROpt(e.target.value)} />
              <Input className="w-16" placeholder="max" value={rMax} onChange={(e)=>setRMax(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>pH du sol — min · optimal · max</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={phMin} onChange={(e)=>setPhMin(e.target.value)} />
              <Input className="w-16" placeholder="opt" value={phOpt} onChange={(e)=>setPhOpt(e.target.value)} />
              <Input className="w-16" placeholder="max" value={phMax} onChange={(e)=>setPhMax(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="req-texture">Texture du sol</Label>
            <Input id="req-texture" className="w-full" placeholder="ex. limono-sableux" value={texture} onChange={(e)=>setTexture(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Enregistrer</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
