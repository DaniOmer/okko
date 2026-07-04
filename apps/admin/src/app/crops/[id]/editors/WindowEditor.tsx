'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { addWindow } from '../../../../lib/api';

const OP_TYPES = ['CLEARING', 'NURSERY', 'PLANTING', 'FERTILIZATION', 'WEEDING', 'PEST_CONTROL', 'HARVEST', 'OTHER'];

interface Op { type: string; label: string; timingDays: string; }

export function WindowEditor({ cropId, zones }: { cropId: string; zones: { id: string; name: string }[] }) {
  const [zoneId, setZoneId] = useState('');
  const [season, setSeason] = useState('');
  const [sowingStart, setSowingStart] = useState(''); const [sowingEnd, setSowingEnd] = useState('');
  const [irrigation, setIrrigation] = useState(false);
  const [ops, setOps] = useState<Op[]>([]);

  if (zones.length === 0) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord une <a href="/zones" className="underline">zone</a> pour ajouter une fenêtre.</p>;
  }

  return (
    <EditorShell label="+ Ajouter une fenêtre de production">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!zoneId) return;
            submit(() => addWindow(cropId, {
              zoneId, season, sowingStart: sowingStart || undefined, sowingEnd: sowingEnd || undefined,
              irrigationRequired: irrigation,
              operations: ops.map((o) => ({ type: o.type, label: { fr: o.label }, timingDays: Number(o.timingDays), inputs: [] })),
            }));
          }}
          className="space-y-2 text-sm"
        >
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger><SelectValue placeholder="— Zone —" /></SelectTrigger>
            <SelectContent>
              {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Saison (ex. Saison sèche)" value={season} onChange={(e) => setSeason(e.target.value)} required />
          <div className="flex gap-1">
            <Input className="flex-1" placeholder="semis début" value={sowingStart} onChange={(e) => setSowingStart(e.target.value)} />
            <Input className="flex-1" placeholder="semis fin" value={sowingEnd} onChange={(e) => setSowingEnd(e.target.value)} />
          </div>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={irrigation} onChange={(e) => setIrrigation(e.target.checked)} /> Irrigation requise</label>

          <div className="border-t pt-2">
            <p className="font-medium">Itinéraire ({ops.length} opérations)</p>
            {ops.map((o, i) => (
              <div key={i} className="flex gap-1 my-1">
                <Select value={o.type} onValueChange={(val) => setOps(ops.map((x, j) => j === i ? { ...x, type: val } : x))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="flex-1" placeholder="libellé" value={o.label} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <Input className="w-16" placeholder="J+" value={o.timingDays} onChange={(e) => setOps(ops.map((x, j) => j === i ? { ...x, timingDays: e.target.value } : x))} />
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setOps([...ops, { type: OP_TYPES[2], label: '', timingDays: '0' }])}>+ opération</Button>
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
