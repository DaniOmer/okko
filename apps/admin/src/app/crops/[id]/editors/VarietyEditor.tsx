'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { addVariety, updateVariety } from '@/lib/actions';

export function VarietyEditor({ cropId, initial }: { cropId: string; initial?: { id: string; name: Record<string, string>; maturityDays?: number; traits: string[] } }) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name.fr ?? '');
  const [maturityDays, setMaturityDays] = useState(initial?.maturityDays != null ? String(initial.maturityDays) : '');
  const [traits, setTraits] = useState(initial?.traits?.join(', ') ?? '');
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
              };
              if (editing) {
                await updateVariety(cropId, initial!.id, body);
              } else {
                await addVariety(cropId, body);
                setName(''); setMaturityDays(''); setTraits('');
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label htmlFor="var-name">Nom de la variété *</Label>
            <Input id="var-name" className="w-full" placeholder="ex. Obatanpa" value={name} onChange={(e)=>setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="var-maturity">Cycle (jours)</Label>
            <Input id="var-maturity" className="w-full" placeholder="ex. 120 (optionnel)" value={maturityDays} onChange={(e)=>setMaturityDays(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="var-traits">Traits</Label>
            <Input id="var-traits" className="w-full" placeholder="séparés par des virgules (optionnel)" value={traits} onChange={(e)=>setTraits(e.target.value)} />
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
