'use client';
import { useState, useEffect } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { OPERATION_TYPE_LABELS, SEASONS } from '@/lib/labels';
import { addWindow, updateWindow, searchFaoCrops, getCalendarSuggestion } from '../../../../lib/api';
import type { CroppingWindow } from '../../../../lib/api';

interface Op { type: string; label: string; timingDays: string; }

export function WindowEditor({ cropId, zones, initial }: { cropId: string; zones: { id: string; name: string }[]; initial?: CroppingWindow }) {
  const editing = !!initial;
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? '');
  const [season, setSeason] = useState(initial?.season ?? '');
  const [sowingStart, setSowingStart] = useState(initial?.sowingStart ?? '');
  const [sowingEnd, setSowingEnd] = useState(initial?.sowingEnd ?? '');
  const [irrigation, setIrrigation] = useState(initial?.irrigationRequired ?? false);
  const [ops, setOps] = useState<Op[]>(initial ? (initial.operations ?? []).map((o) => ({ type: o.type, label: o.label.fr ?? '', timingDays: String(o.timingDays) })) : []);

  // FAO import state
  const [faoQuery, setFaoQuery] = useState('');
  const [faoResults, setFaoResults] = useState<{ code: string; nameFr: string; nameEn: string }[]>([]);
  const [faoPicked, setFaoPicked] = useState<{ code: string; nameFr: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  useEffect(() => {
    if (!faoQuery || faoPicked) { setFaoResults([]); return; }
    const timer = setTimeout(async () => {
      const results = await searchFaoCrops(faoQuery);
      setFaoResults(results);
    }, 300);
    return () => clearTimeout(timer);
  }, [faoQuery, faoPicked]);

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
              operations: ops.map((o) => ({ type: o.type, label: { fr: o.label }, timingDays: Number(o.timingDays), inputs: [] })),
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
          <div className="space-y-1 border rounded p-2 bg-muted/30">
            <p className="font-medium text-xs">Importer depuis le calendrier FAO</p>
            <div className="relative">
              <Input
                placeholder="Rechercher une culture FAO…"
                value={faoQuery}
                onChange={(e) => { setFaoQuery(e.target.value); setFaoPicked(null); setImportMsg(''); }}
              />
              {faoResults.length > 0 && (
                <ul className="absolute z-10 w-full bg-background border rounded shadow-md mt-1 max-h-48 overflow-y-auto">
                  {faoResults.map((r) => (
                    <li
                      key={r.code}
                      className="px-3 py-1.5 cursor-pointer hover:bg-accent text-sm"
                      onClick={() => { setFaoPicked({ code: r.code, nameFr: r.nameFr }); setFaoQuery(r.nameFr); setFaoResults([]); }}
                    >
                      {r.nameFr}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!faoPicked || !zoneId || importing}
              onClick={async () => {
                if (!faoPicked) return;
                setImporting(true);
                setImportMsg('');
                try {
                  const s = await getCalendarSuggestion(cropId, faoPicked.code, zoneId);
                  if (s) {
                    setSowingStart(s.sowingStart);
                    setSowingEnd(s.sowingEnd);
                    setImportMsg('Importé depuis FAO — relisez puis enregistrez.');
                  } else {
                    setImportMsg('Source FAO indisponible — saisie manuelle.');
                  }
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? 'Import…' : 'Importer le calendrier FAO'}
            </Button>
            {importMsg && <p className="text-xs text-muted-foreground">{importMsg}</p>}
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
              <div key={i} className="flex gap-1 my-1 items-center">
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
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setOps([...ops, { type: 'PLANTING', label: '', timingDays: '0' }])}>+ opération</Button>
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
