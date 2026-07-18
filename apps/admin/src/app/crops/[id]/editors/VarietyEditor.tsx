'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { RESISTANCE_LEVEL_LABELS, SUITABILITY_RATING_LABELS } from '@/lib/labels';
import { addVariety, updateVariety } from '@/lib/actions';
import type { Pest, Zone, Variety } from '@/lib/api';

interface ResistanceRow { pestId: string; level: string; }
interface AdaptationRow { zoneId: string; rating: string; }

export function VarietyEditor({
  cropId,
  initial,
  diseases,
  zones,
}: {
  cropId: string;
  initial?: Variety;
  diseases: Pest[];
  zones: Zone[];
}) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name.fr ?? '');
  const [maturityDays, setMaturityDays] = useState(initial?.maturityDays != null ? String(initial.maturityDays) : '');
  const [traits, setTraits] = useState(initial?.traits?.join(', ') ?? '');

  const [resistances, setResistances] = useState<ResistanceRow[]>(
    initial?.diseaseResistances?.map((r) => ({ pestId: r.pestId, level: r.level })) ?? [],
  );
  const [adaptations, setAdaptations] = useState<AdaptationRow[]>(
    initial?.zoneAdaptations?.map((a) => ({ zoneId: a.zoneId, rating: a.rating })) ?? [],
  );

  function addResistance() {
    setResistances((prev) => [...prev, { pestId: diseases[0]?.id ?? '', level: 'MEDIUM' }]);
  }
  function removeResistance(idx: number) {
    setResistances((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateResistance(idx: number, key: keyof ResistanceRow, value: string) {
    setResistances((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  function addAdaptation() {
    setAdaptations((prev) => [...prev, { zoneId: zones[0]?.id ?? '', rating: 'SUITABLE' }]);
  }
  function removeAdaptation(idx: number) {
    setAdaptations((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateAdaptation(idx: number, key: keyof AdaptationRow, value: string) {
    setAdaptations((prev) => prev.map((a, i) => (i === idx ? { ...a, [key]: value } : a)));
  }

  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter une variété'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(async () => {
              const body = {
                name: { fr: name },
                maturityDays: maturityDays ? Number(maturityDays) : undefined,
                traits: traits ? traits.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
                diseaseResistances: resistances.filter((r) => r.pestId),
                zoneAdaptations: adaptations.filter((a) => a.zoneId),
              };
              if (editing) {
                await updateVariety(cropId, initial!.id, body);
              } else {
                await addVariety(cropId, body);
                setName(''); setMaturityDays(''); setTraits('');
                setResistances([]); setAdaptations([]);
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label htmlFor="var-name">Nom de la variété *</Label>
            <Input id="var-name" className="w-full" placeholder="ex. Obatanpa" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="var-maturity">Cycle (jours)</Label>
            <Input id="var-maturity" className="w-full" placeholder="ex. 120 (optionnel)" value={maturityDays} onChange={(e) => setMaturityDays(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="var-traits">Traits</Label>
            <Input id="var-traits" className="w-full" placeholder="séparés par des virgules (optionnel)" value={traits} onChange={(e) => setTraits(e.target.value)} />
          </div>

          {/* Résistances aux maladies */}
          <div className="space-y-2">
            <Label>Résistances</Label>
            {resistances.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={row.pestId} onValueChange={(v) => updateResistance(idx, 'pestId', v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="— Maladie —" /></SelectTrigger>
                  <SelectContent>
                    {diseases.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={row.level} onValueChange={(v) => updateResistance(idx, 'level', v)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESISTANCE_LEVEL_LABELS).map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeResistance(idx)}>✕</Button>
              </div>
            ))}
            {diseases.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={addResistance}>+ résistance</Button>
            )}
          </div>

          {/* Adaptation par zone */}
          <div className="space-y-2">
            <Label>Adaptation par zone</Label>
            {adaptations.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={row.zoneId} onValueChange={(v) => updateAdaptation(idx, 'zoneId', v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="— Zone —" /></SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={row.rating} onValueChange={(v) => updateAdaptation(idx, 'rating', v)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUITABILITY_RATING_LABELS).map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeAdaptation(idx)}>✕</Button>
              </div>
            ))}
            {zones.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={addAdaptation}>+ zone</Button>
            )}
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
