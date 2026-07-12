'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CYCLE_TYPE_LABELS } from '@/lib/labels';
import { updateCrop } from '../../../../lib/api';

export function IdentityEditor({ cropId, initial }: { cropId: string; initial: { name: string; scientificName: string; family: string; cycleType: string } }) {
  const [name, setName] = useState(initial.name);
  const [scientificName, setSci] = useState(initial.scientificName);
  const [family, setFamily] = useState(initial.family);
  const [cycleType, setCycle] = useState(initial.cycleType);
  return (
    <EditorShell label="Modifier l'identité">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(() => updateCrop(cropId, { commonNames: { fr: name }, scientificName, family, cycleType })); }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1"><Label htmlFor="id-name">Nom (fr)</Label><Input id="id-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-1"><Label htmlFor="id-sci">Nom scientifique</Label><Input id="id-sci" value={scientificName} onChange={(e) => setSci(e.target.value)} required /></div>
          <div className="space-y-1"><Label htmlFor="id-fam">Famille</Label><Input id="id-fam" value={family} onChange={(e) => setFamily(e.target.value)} required /></div>
          <div className="space-y-1">
            <Label>Type de cycle</Label>
            <Select value={cycleType} onValueChange={setCycle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CYCLE_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Enregistrer</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
