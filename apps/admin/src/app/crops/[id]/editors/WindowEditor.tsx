'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { OPERATION_TYPE_LABELS, SEASONS } from '@/lib/labels';
import { addWindow, updateWindow } from '@/lib/actions';
import type { CroppingWindow } from '@/lib/api';

interface Op { type: string; label: string; timingDays: string; inputs: string; equipment: string; }

export function WindowEditor({ cropId, zones, initial }: { cropId: string; zones: { id: string; name: string }[]; initial?: CroppingWindow }) {
  const editing = !!initial;
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? '');
  const [season, setSeason] = useState(initial?.season ?? '');
  const [sowingStart, setSowingStart] = useState(initial?.sowingStart ?? '');
  const [sowingEnd, setSowingEnd] = useState(initial?.sowingEnd ?? '');
  const [irrigation, setIrrigation] = useState(initial?.irrigationRequired ?? false);
  const [ops, setOps] = useState<Op[]>(initial ? (initial.operations ?? []).map((o) => ({ type: o.type, label: o.label.fr ?? '', timingDays: String(o.timingDays), inputs: (o.inputs ?? []).join(', '), equipment: (o.equipment ?? []).join(', ') })) : []);

  if (zones.length === 0 && !editing) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord une <a href="/zones" className="underline">zone</a> pour ajouter une fenêtre.</p>;
  }

  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter une fenêtre de production'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!zoneId || !season) return;
            const body = {
              zoneId, season, sowingStart: sowingStart || undefined, sowingEnd: sowingEnd || undefined,
              irrigationRequired: irrigation,
              operations: ops.map((o) => ({
                type: o.type, label: { fr: o.label }, timingDays: Number(o.timingDays),
                inputs: o.inputs.split(',').map((s) => s.trim()).filter(Boolean),
                equipment: o.equipment.split(',').map((s) => s.trim()).filter(Boolean),
              })),
            };
            submit(async () => {
              if (editing) {
                await updateWindow(cropId, initial!.id, body);
              } else {
                await addWindow(cropId, body);
                setZoneId(''); setSeason(''); setSowingStart(''); setSowingEnd(''); setIrrigation(false); setOps([]);
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Zone *</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger><SelectValue placeholder="— Choisir une zone —" /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Saison *</Label>
            <Select value={season} onValueChange={setSeason}>
              <SelectTrigger><SelectValue placeholder="— Choisir une saison —" /></SelectTrigger>
              <SelectContent>
                {SEASONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Fenêtre de semis (début / fin)</Label>
            <div className="flex gap-1">
              <DatePicker value={sowingStart} onChange={setSowingStart} />
              <DatePicker value={sowingEnd} onChange={setSowingEnd} />
            </div>
          </div>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={irrigation} onChange={(e) => setIrrigation(e.target.checked)} /> Irrigation requise</label>

          <div className="border-t pt-2">
            <p className="font-medium">Itinéraire technique ({ops.length} opérations)</p>
            <p className="text-xs text-muted-foreground">J0 = semis ; négatif = avant le semis (ex. -15).</p>
            {ops.map((o, i) => (
              <div key={i} className="my-1 space-y-1">
                <div className="flex gap-1 items-center">
                  <Select value={o.type} onValueChange={(val) => setOps(ops.map((x, j) => j === i ? { ...x, type: val } : x))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(OPERATION_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="flex-1" placeholder="libellé" value={o.label} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <Input className="w-16" placeholder="J±" value={o.timingDays} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, timingDays: e.target.value } : x))} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOps(ops.filter((_, j) => j !== i))}>×</Button>
                </div>
                <div className="flex gap-1 items-center pl-1">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Intrants</span>
                  <Input className="flex-1" placeholder="semences, engrais… (séparés par ,)" value={o.inputs} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, inputs: e.target.value } : x))} />
                </div>
                <div className="flex gap-1 items-center pl-1">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Matériel</span>
                  <Input className="flex-1" placeholder="semoir, tracteur… (séparés par ,)" value={o.equipment} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, equipment: e.target.value } : x))} />
                </div>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setOps([...ops, { type: 'PLANTING', label: '', timingDays: '0', inputs: '', equipment: '' }])}>+ opération</Button>
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
