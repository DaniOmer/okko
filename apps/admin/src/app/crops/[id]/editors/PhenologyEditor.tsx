'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { setPhenology } from '@/lib/actions';
import type { PhenologicalStage } from '@/lib/api';

export function PhenologyEditor({ cropId, current, editIndex }: { cropId: string; current: PhenologicalStage[]; editIndex?: number }) {
  const editing = editIndex != null;
  const [name, setName] = useState(current[editIndex!]?.name.fr ?? '');
  const [start, setStart] = useState(String(current[editIndex!]?.startDay ?? ''));
  const [end, setEnd] = useState(String(current[editIndex!]?.endDay ?? ''));
  const [description, setDescription] = useState(current[editIndex!]?.description ?? '');
  const [recommendedWork, setRecommendedWork] = useState(current[editIndex!]?.recommendedWork ?? '');
  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter un stade phénologique'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nouvelItem = {
              name: { fr: name },
              startDay: Number(start),
              endDay: Number(end),
              order: editing ? current[editIndex].order : current.length + 1,
              description: description || undefined,
              recommendedWork: recommendedWork || undefined,
            };
            const next = editing
              ? current.map((it, i) => i === editIndex ? nouvelItem : it)
              : [...current, nouvelItem];
            submit(async () => {
              await setPhenology(cropId, next);
              if (!editing) {
                setName(''); setStart(''); setEnd(''); setDescription(''); setRecommendedWork('');
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label htmlFor="phen-name">Nom du stade *</Label>
            <Input id="phen-name" className="w-full" placeholder="ex. Levée" value={name} onChange={(e)=>setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Jours après semis — début · fin *</Label>
            <div className="flex gap-1 items-center">
              <Input className="w-20" placeholder="début" value={start} onChange={(e)=>setStart(e.target.value)} required />
              <Input className="w-20" placeholder="fin" value={end} onChange={(e)=>setEnd(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="phen-description">Description</Label>
            <Textarea id="phen-description" className="w-full" placeholder="Description du stade" value={description} onChange={(e)=>setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phen-recommended-work">Travaux recommandés</Label>
            <Textarea id="phen-recommended-work" className="w-full" placeholder="Travaux à réaliser durant ce stade" value={recommendedWork} onChange={(e)=>setRecommendedWork(e.target.value)} />
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
