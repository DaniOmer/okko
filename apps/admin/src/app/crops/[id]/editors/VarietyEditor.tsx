'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { addVariety } from '../../../../lib/api';

export function VarietyEditor({ cropId }: { cropId: string }) {
  const [name, setName] = useState(''); const [maturityDays, setMaturityDays] = useState(''); const [traits, setTraits] = useState('');
  return (
    <EditorShell label="+ Ajouter une variété">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => addVariety(cropId, {
              name: { fr: name },
              maturityDays: maturityDays ? Number(maturityDays) : undefined,
              traits: traits ? traits.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
            }));
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
            <Button type="submit" size="sm" disabled={busy}>Ajouter</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
