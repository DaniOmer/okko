'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
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
    return <p className="text-sm text-gray-500">Créez d&apos;abord une <a href="/zones" className="underline">zone</a> pour ajouter une fenêtre.</p>;
  }

  return (
    <EditorShell label="+ Ajouter une fenêtre de production">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => addWindow(cropId, {
              zoneId, season, sowingStart: sowingStart || undefined, sowingEnd: sowingEnd || undefined,
              irrigationRequired: irrigation,
              operations: ops.map((o) => ({ type: o.type, label: { fr: o.label }, timingDays: Number(o.timingDays), inputs: [] })),
            }));
          }}
          className="space-y-2 text-sm"
        >
          <select className="w-full border p-1" value={zoneId} onChange={(e)=>setZoneId(e.target.value)} required>
            <option value="">— Zone —</option>
            {zones.map((z)=><option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <input className="w-full border p-1" placeholder="Saison (ex. Saison sèche)" value={season} onChange={(e)=>setSeason(e.target.value)} required />
          <div className="flex gap-1">
            <input className="flex-1 border p-1" placeholder="semis début" value={sowingStart} onChange={(e)=>setSowingStart(e.target.value)} />
            <input className="flex-1 border p-1" placeholder="semis fin" value={sowingEnd} onChange={(e)=>setSowingEnd(e.target.value)} />
          </div>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={irrigation} onChange={(e)=>setIrrigation(e.target.checked)} /> Irrigation requise</label>

          <div className="border-t pt-2">
            <p className="font-medium">Itinéraire ({ops.length} opérations)</p>
            {ops.map((o, i) => (
              <div key={i} className="flex gap-1 my-1">
                <select className="border p-1" value={o.type} onChange={(e)=>setOps(ops.map((x,j)=>j===i?{...x,type:e.target.value}:x))}>{OP_TYPES.map((t)=><option key={t} value={t}>{t}</option>)}</select>
                <input className="flex-1 border p-1" placeholder="libellé" value={o.label} onChange={(e)=>setOps(ops.map((x,j)=>j===i?{...x,label:e.target.value}:x))} />
                <input className="w-16 border p-1" placeholder="J+" value={o.timingDays} onChange={(e)=>setOps(ops.map((x,j)=>j===i?{...x,timingDays:e.target.value}:x))} />
              </div>
            ))}
            <button type="button" onClick={()=>setOps([...ops, { type: OP_TYPES[2], label: '', timingDays: '0' }])} className="text-green-700 underline">+ opération</button>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
