'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { INPUT_TYPE_LABELS } from '@/lib/labels';
import { setYields } from '@/lib/actions';
import type { YieldReference } from '@/lib/api';

const UNITS = ['t/ha', 'kg/ha', 'q/ha'];

export function YieldsEditor({ cropId, current, zones, editIndex }: { cropId: string; current: YieldReference[]; zones: { zoneId: string; zoneName: Record<string, string> }[]; editIndex?: number }) {
  const editing = editIndex != null;
  const [inputType, setInputType] = useState(current[editIndex!]?.inputType ?? 'CHEMICAL');
  const [min, setMin] = useState(String(current[editIndex!]?.min ?? ''));
  const [avg, setAvg] = useState(String(current[editIndex!]?.average ?? ''));
  const [pot, setPot] = useState(String(current[editIndex!]?.potential ?? ''));
  const [unit, setUnit] = useState(current[editIndex!]?.unit ?? 't/ha');
  const [zoneId, setZoneId] = useState(current[editIndex!]?.zoneId ?? '');
  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter un rendement de référence'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nouvelItem = { inputType, min: Number(min), average: Number(avg), potential: Number(pot), unit, zoneId: zoneId || undefined };
            const next = editing
              ? current.map((it, i) => i === editIndex ? nouvelItem : it)
              : [...current, nouvelItem];
            submit(async () => {
              await setYields(cropId, next);
              if (!editing) {
                setInputType('CHEMICAL'); setMin(''); setAvg(''); setPot(''); setUnit('t/ha'); setZoneId('');
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Type d&apos;intrants</Label>
            <Select value={inputType} onValueChange={setInputType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INPUT_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Rendement (min · moyen · potentiel) et unité</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-16" placeholder="min" value={min} onChange={(e) => setMin(e.target.value)} required />
              <Input className="w-16" placeholder="moyen" value={avg} onChange={(e) => setAvg(e.target.value)} required />
              <Input className="w-16" placeholder="potentiel" value={pot} onChange={(e) => setPot(e.target.value)} required />
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Zone (optionnel)</Label>
            <Select value={zoneId || 'GLOBAL'} onValueChange={(v) => setZoneId(v === 'GLOBAL' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GLOBAL">Toutes zones (global)</SelectItem>
                {zones.map((z) => <SelectItem key={z.zoneId} value={z.zoneId}>{z.zoneName.fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
