'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { setRequirements } from '@/lib/actions';
import { WATER_NEED_LABELS, DROUGHT_SENSITIVITY_LABELS } from '@/lib/labels';

const n = (v: string): number => Number(v);

export function RequirementsEditor({ cropId }: { cropId: string }) {
  const [tMin, setTMin] = useState(''); const [tOpt, setTOpt] = useState(''); const [tMax, setTMax] = useState('');
  const [rMin, setRMin] = useState(''); const [rOpt, setROpt] = useState(''); const [rMax, setRMax] = useState('');
  const [aMin, setAMin] = useState(''); const [aOpt, setAOpt] = useState(''); const [aMax, setAMax] = useState('');
  const [waterNeed, setWaterNeed] = useState('');
  const [droughtSensitivity, setDroughtSensitivity] = useState('');
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
            if (aMin && aOpt && aMax) body.climatic = { ...(body.climatic ?? {}), altitude: { min: n(aMin), optimal: n(aOpt), max: n(aMax), unit: 'm' } };
            if (waterNeed) body.climatic = { ...(body.climatic ?? {}), waterNeed };
            if (droughtSensitivity) body.climatic = { ...(body.climatic ?? {}), droughtSensitivity };
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
            <Label>Altitude — min · optimal · max (m)</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={aMin} onChange={(e)=>setAMin(e.target.value)} />
              <Input className="w-16" placeholder="opt" value={aOpt} onChange={(e)=>setAOpt(e.target.value)} />
              <Input className="w-16" placeholder="max" value={aMax} onChange={(e)=>setAMax(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="req-water-need">Besoin en eau</Label>
            <select
              id="req-water-need"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={waterNeed}
              onChange={(e) => setWaterNeed(e.target.value)}
            >
              <option value="">— non renseigné —</option>
              {Object.entries(WATER_NEED_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="req-drought-sensitivity">Sensibilité à la sécheresse</Label>
            <select
              id="req-drought-sensitivity"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={droughtSensitivity}
              onChange={(e) => setDroughtSensitivity(e.target.value)}
            >
              <option value="">— non renseigné —</option>
              {Object.entries(DROUGHT_SENSITIVITY_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
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
