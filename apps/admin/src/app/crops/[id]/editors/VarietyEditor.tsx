'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
          className="space-y-2 text-sm"
        >
          <Input className="w-full" placeholder="Nom (fr)" value={name} onChange={(e)=>setName(e.target.value)} required />
          <Input className="w-full" placeholder="Cycle (jours, optionnel)" value={maturityDays} onChange={(e)=>setMaturityDays(e.target.value)} />
          <Input className="w-full" placeholder="Traits (séparés par des virgules)" value={traits} onChange={(e)=>setTraits(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Ajouter</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
