'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SUSCEPTIBILITY_LABELS, CONTROL_CATEGORY_LABELS, stageWithRange } from '@/lib/labels';
import { setPestControl, deleteCropPest } from '@/lib/actions';
import { DeleteWithConfirm } from './DeleteWithConfirm';

interface ControlMethod { category: string; description: Record<string, string>; inputs: string[]; }
interface PestInitial {
  pestId: string;
  susceptibility: string;
  threshold?: string;
  sensitiveStages: string[];
  controlMethods: ControlMethod[];
}

export function PestControlEditor({
  cropId,
  pests,
  initial,
  phenology,
}: {
  cropId: string;
  pests: { id: string; name: string }[];
  initial?: PestInitial;
  phenology: { name: Record<string, string>; startDay: number; endDay: number }[];
}) {
  const editing = !!initial;
  const [pestId, setPestId] = useState(initial?.pestId ?? '');
  const [susceptibility, setSusceptibility] = useState(initial?.susceptibility ?? 'MEDIUM');
  const [threshold, setThreshold] = useState(initial?.threshold ?? '');
  const [stages, setStages] = useState<string[]>(initial?.sensitiveStages ?? []);
  const [methods, setMethods] = useState<ControlMethod[]>(initial?.controlMethods ?? []);

  const addMethod = () => setMethods([...methods, { category: 'PREVENTION', description: { fr: '' }, inputs: [] }]);
  const removeMethod = (i: number) => setMethods(methods.filter((_, k) => k !== i));
  const setMethodCategory = (i: number, category: string) => setMethods(methods.map((m, k) => (k === i ? { ...m, category } : m)));
  const setMethodDescription = (i: number, fr: string) => setMethods(methods.map((m, k) => (k === i ? { ...m, description: { ...m.description, fr } } : m)));
  const setMethodInputs = (i: number, raw: string) => setMethods(methods.map((m, k) => (k === i ? { ...m, inputs: raw.split(',').map((x) => x.trim()).filter(Boolean) } : m)));

  if (pests.length === 0) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord un <a href="/pests" className="underline">ravageur</a> pour le rattacher.</p>;
  }
  return (
    <EditorShell label={editing ? 'Modifier' : '+ Rattacher un ravageur / une maladie'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pestId) return;
            const cleanMethods = methods
              .filter((m) => m.category && (m.description.fr ?? '').trim() !== '')
              .map((m) => ({ category: m.category, description: { fr: m.description.fr.trim() }, inputs: m.inputs }));
            submit(async () => {
              await setPestControl(cropId, pestId, {
                susceptibility,
                threshold: threshold || undefined,
                sensitiveStages: stages.length ? stages : undefined,
                controlMethods: cleanMethods,
              });
              if (!editing) {
                setPestId(''); setSusceptibility('MEDIUM'); setThreshold(''); setStages([]); setMethods([]);
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Ravageur / maladie *</Label>
            <Select value={pestId} onValueChange={setPestId} disabled={editing}>
              <SelectTrigger><SelectValue placeholder="— Ravageur / maladie —" /></SelectTrigger>
              <SelectContent>
                {pests.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Sensibilité</Label>
            <Select value={susceptibility} onValueChange={setSusceptibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SUSCEPTIBILITY_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Seuil de nuisibilité (optionnel)</Label>
            <Input placeholder="seuil de nuisibilité (optionnel)" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Stades sensibles (optionnel)</Label>
            {phenology.length === 0
              ? <p className="text-xs text-muted-foreground">Définissez la phénologie pour cibler des stades sensibles.</p>
              : phenology.map((p) => {
                  const nm = p.name.fr;
                  return (
                    <label key={nm} className="flex gap-2 items-center">
                      <input type="checkbox" checked={stages.includes(nm)} onChange={(e) => setStages(e.target.checked ? [...stages, nm] : stages.filter((x) => x !== nm))} />
                      {stageWithRange(nm, phenology)}
                    </label>
                  );
                })}
          </div>
          <div className="space-y-2">
            <Label>Méthodes de lutte (optionnel)</Label>
            {methods.map((m, i) => (
              <div key={i} className="space-y-1 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <Select value={m.category} onValueChange={(v) => setMethodCategory(i, v)}>
                    <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTROL_CATEGORY_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button type="button" className="text-xs text-destructive" onClick={() => removeMethod(i)}>Supprimer</button>
                </div>
                <Input placeholder="Description (fr)" value={m.description.fr ?? ''} onChange={(e) => setMethodDescription(i, e.target.value)} />
                <Input placeholder="Intrants (séparés par des virgules)" value={m.inputs.join(', ')} onChange={(e) => setMethodInputs(i, e.target.value)} />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addMethod}>+ Ajouter une méthode</Button>
          </div>
          <div className="flex items-center gap-2 pt-2">
            {editing && <DeleteWithConfirm disabled={busy} onConfirm={() => submit(() => deleteCropPest(cropId, initial!.pestId))} />}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
              <Button type="submit" size="sm" disabled={busy}>{editing ? 'Enregistrer' : 'Rattacher'}</Button>
            </div>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
