'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ShadcnDatePicker } from '@/components/shadcn-date-picker';
import { Badge } from '@/components/ui/badge';
import { OPERATION_TYPE_LABELS, SEASONS } from '@/lib/labels';
import { addWindow, updateWindow } from '@/lib/actions';
import type { CroppingWindow } from '@/lib/api';

interface Op { type: string; label: string; timingDays: string; inputs: string[]; equipment: string[]; }

const DAY_MIN = -60;
const DAY_MAX = 365;
function clampDays(raw: string): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.min(DAY_MAX, Math.max(DAY_MIN, n));
}

/** Saisie de valeurs libres en puces : Entrée ou virgule ajoute, clic sur une puce retire. */
function TagInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  function commit() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  }
  return (
    <div className="flex-1 space-y-1">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="cursor-pointer" onClick={() => onChange(values.filter((x) => x !== v))}>
              {v} ×
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <Input
          className="flex-1"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={commit} disabled={!draft.trim()}>+</Button>
      </div>
    </div>
  );
}

export function WindowEditor({ cropId, zones, initial }: { cropId: string; zones: { id: string; name: string }[]; initial?: CroppingWindow }) {
  const editing = !!initial;
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? '');
  const [season, setSeason] = useState(initial?.season ?? '');
  const [sowingStart, setSowingStart] = useState(initial?.sowingStart ?? '');
  const [sowingEnd, setSowingEnd] = useState(initial?.sowingEnd ?? '');
  const [irrigation, setIrrigation] = useState(initial?.irrigationRequired ?? false);
  const [ops, setOps] = useState<Op[]>(initial ? (initial.operations ?? []).map((o) => ({ type: o.type, label: o.label.fr ?? '', timingDays: String(o.timingDays), inputs: o.inputs ?? [], equipment: o.equipment ?? [] })) : []);
  const updateOp = (i: number, patch: Partial<Op>) => setOps((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

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
                type: o.type, label: { fr: o.label.trim() }, timingDays: clampDays(o.timingDays),
                inputs: o.inputs,
                equipment: o.equipment,
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
            <div className="grid grid-cols-2 gap-3">
              <ShadcnDatePicker value={sowingStart} onChange={setSowingStart} />
              <ShadcnDatePicker value={sowingEnd} onChange={setSowingEnd} />
            </div>
          </div>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={irrigation} onChange={(e) => setIrrigation(e.target.checked)} /> Irrigation requise</label>

          <div className="border-t pt-2">
            <p className="font-medium">Itinéraire technique ({ops.length} opérations)</p>
            <p className="text-xs text-muted-foreground">Chaque opération : un type, un libellé, et un décalage en jours par rapport au semis (J0 = semis ; négatif = avant, ex. -15).</p>
            {ops.map((o, i) => (
              <div key={i} className="my-2 space-y-1 rounded-md border p-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={o.type} onValueChange={(val) => updateOp(i, { type: val })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(OPERATION_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Jours vs semis (J±)</Label>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        step={1}
                        min={DAY_MIN}
                        max={DAY_MAX}
                        placeholder="0"
                        title="Nombre de jours par rapport au semis (J0). Négatif = avant le semis."
                        value={o.timingDays}
                        onChange={(e) => updateOp(i, { timingDays: e.target.value })}
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setOps(ops.filter((_, j) => j !== i))} title="Retirer l'opération">×</Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Libellé</Label>
                  <Input placeholder="ex. Premier sarclage manuel" value={o.label} onChange={(e) => updateOp(i, { label: e.target.value })} />
                </div>
                <div className="flex gap-1 items-start">
                  <span className="text-xs text-muted-foreground w-20 shrink-0 pt-2">Intrants</span>
                  <TagInput values={o.inputs} onChange={(v) => updateOp(i, { inputs: v })} placeholder="ex. semences (Entrée pour ajouter)" />
                </div>
                <div className="flex gap-1 items-start">
                  <span className="text-xs text-muted-foreground w-20 shrink-0 pt-2">Matériel</span>
                  <TagInput values={o.equipment} onChange={(v) => updateOp(i, { equipment: v })} placeholder="ex. semoir (Entrée pour ajouter)" />
                </div>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setOps([...ops, { type: 'PLANTING', label: '', timingDays: '0', inputs: [], equipment: [] }])}>+ opération</Button>
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
