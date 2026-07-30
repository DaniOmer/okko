'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { setRequirements } from '@/lib/actions';
import { WATER_NEED_LABELS, DROUGHT_SENSITIVITY_LABELS, PHOTOPERIOD_RESPONSE_LABELS, FERTILITY_LABELS, DRAINAGE_LABELS, SALINITY_TOLERANCE_LABELS } from '@/lib/labels';

const n = (v: string): number => Number(v);
const s = (v?: number): string => (v === undefined || v === null ? '' : String(v));

interface Range { min: number; optimal: number; max: number; unit: string }
export interface RequirementsInitial {
  climatic?: { temperature?: Range; rainfall?: Range; altitude?: Range; waterNeed?: string; droughtSensitivity?: string; photoperiodResponse?: string; criticalDayLength?: Range };
  edaphic?: { ph?: Range; texture?: string; drainage?: string; soilDepth?: Range; fertilityRequirement?: string; salinityTolerance?: string };
}

export function RequirementsEditor({ cropId, initial }: { cropId: string; initial?: RequirementsInitial }) {
  const c = initial?.climatic;
  const e = initial?.edaphic;
  const [tMin, setTMin] = useState(s(c?.temperature?.min)); const [tOpt, setTOpt] = useState(s(c?.temperature?.optimal)); const [tMax, setTMax] = useState(s(c?.temperature?.max));
  const [rMin, setRMin] = useState(s(c?.rainfall?.min)); const [rOpt, setROpt] = useState(s(c?.rainfall?.optimal)); const [rMax, setRMax] = useState(s(c?.rainfall?.max));
  const [aMin, setAMin] = useState(s(c?.altitude?.min)); const [aOpt, setAOpt] = useState(s(c?.altitude?.optimal)); const [aMax, setAMax] = useState(s(c?.altitude?.max));
  const [waterNeed, setWaterNeed] = useState(c?.waterNeed ?? '');
  const [droughtSensitivity, setDroughtSensitivity] = useState(c?.droughtSensitivity ?? '');
  const [phMin, setPhMin] = useState(s(e?.ph?.min)); const [phOpt, setPhOpt] = useState(s(e?.ph?.optimal)); const [phMax, setPhMax] = useState(s(e?.ph?.max));
  const [texture, setTexture] = useState(e?.texture ?? '');
  const [photoperiod, setPhotoperiod] = useState(c?.photoperiodResponse ?? '');
  const [cdlMin, setCdlMin] = useState(s(c?.criticalDayLength?.min)); const [cdlOpt, setCdlOpt] = useState(s(c?.criticalDayLength?.optimal)); const [cdlMax, setCdlMax] = useState(s(c?.criticalDayLength?.max));
  const [depthMin, setDepthMin] = useState(s(e?.soilDepth?.min)); const [depthOpt, setDepthOpt] = useState(s(e?.soilDepth?.optimal)); const [depthMax, setDepthMax] = useState(s(e?.soilDepth?.max));
  const [drainage, setDrainage] = useState(e?.drainage ?? '');
  const [fertility, setFertility] = useState(e?.fertilityRequirement ?? '');
  const [salinity, setSalinity] = useState(e?.salinityTolerance ?? '');

  return (
    <EditorShell label="Éditer les exigences climat/sol">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            const body: Parameters<typeof setRequirements>[1] = {};
            if (tMin && tOpt && tMax) body.climatic = { ...(body.climatic ?? {}), temperature: { min: n(tMin), optimal: n(tOpt), max: n(tMax), unit: '°C' } };
            if (rMin && rOpt && rMax) body.climatic = { ...(body.climatic ?? {}), rainfall: { min: n(rMin), optimal: n(rOpt), max: n(rMax), unit: 'mm' } };
            if (aMin && aOpt && aMax) body.climatic = { ...(body.climatic ?? {}), altitude: { min: n(aMin), optimal: n(aOpt), max: n(aMax), unit: 'm' } };
            if (waterNeed) body.climatic = { ...(body.climatic ?? {}), waterNeed };
            if (droughtSensitivity) body.climatic = { ...(body.climatic ?? {}), droughtSensitivity };
            if (phMin && phOpt && phMax) body.edaphic = { ...(body.edaphic ?? {}), ph: { min: n(phMin), optimal: n(phOpt), max: n(phMax), unit: 'pH' } };
            if (texture) body.edaphic = { ...(body.edaphic ?? {}), texture };
            if (photoperiod) body.climatic = { ...(body.climatic ?? {}), photoperiodResponse: photoperiod };
            if (cdlMin && cdlOpt && cdlMax) body.climatic = { ...(body.climatic ?? {}), criticalDayLength: { min: n(cdlMin), optimal: n(cdlOpt), max: n(cdlMax), unit: 'h' } };
            if (depthMin && depthOpt && depthMax) body.edaphic = { ...(body.edaphic ?? {}), soilDepth: { min: n(depthMin), optimal: n(depthOpt), max: n(depthMax), unit: 'cm' } };
            if (drainage) body.edaphic = { ...(body.edaphic ?? {}), drainage };
            if (fertility) body.edaphic = { ...(body.edaphic ?? {}), fertilityRequirement: fertility };
            if (salinity) body.edaphic = { ...(body.edaphic ?? {}), salinityTolerance: salinity };
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
            <Label>Besoin en eau</Label>
            <Select value={waterNeed} onValueChange={setWaterNeed}>
              <SelectTrigger><SelectValue placeholder="— non renseigné —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(WATER_NEED_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Sensibilité à la sécheresse</Label>
            <Select value={droughtSensitivity} onValueChange={setDroughtSensitivity}>
              <SelectTrigger><SelectValue placeholder="— non renseigné —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(DROUGHT_SENSITIVITY_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Photopériode</Label>
            <Select value={photoperiod} onValueChange={setPhotoperiod}>
              <SelectTrigger><SelectValue placeholder="— non renseigné —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PHOTOPERIOD_RESPONSE_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Jour critique — min · optimal · max (h)</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={cdlMin} onChange={(e)=>setCdlMin(e.target.value)} />
              <Input className="w-16" placeholder="opt" value={cdlOpt} onChange={(e)=>setCdlOpt(e.target.value)} />
              <Input className="w-16" placeholder="max" value={cdlMax} onChange={(e)=>setCdlMax(e.target.value)} />
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
          <div className="space-y-1">
            <Label>Profondeur de sol — min · optimal · max (cm)</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={depthMin} onChange={(e)=>setDepthMin(e.target.value)} />
              <Input className="w-16" placeholder="opt" value={depthOpt} onChange={(e)=>setDepthOpt(e.target.value)} />
              <Input className="w-16" placeholder="max" value={depthMax} onChange={(e)=>setDepthMax(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Drainage</Label>
            <Select value={drainage} onValueChange={setDrainage}>
              <SelectTrigger><SelectValue placeholder="— non renseigné —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(DRAINAGE_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Fertilité requise</Label>
            <Select value={fertility} onValueChange={setFertility}>
              <SelectTrigger><SelectValue placeholder="— non renseigné —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(FERTILITY_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tolérance à la salinité</Label>
            <Select value={salinity} onValueChange={setSalinity}>
              <SelectTrigger><SelectValue placeholder="— non renseigné —" /></SelectTrigger>
              <SelectContent>
                {Object.entries(SALINITY_TOLERANCE_LABELS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
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
