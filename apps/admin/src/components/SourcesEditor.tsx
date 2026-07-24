'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface SourceRow { title: string; url?: string; }

export function SourcesEditor({ value, onChange }: { value: SourceRow[]; onChange: (v: SourceRow[]) => void }) {
  const add = () => onChange([...value, { title: '' }]);
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const setTitle = (i: number, title: string) => onChange(value.map((s, k) => (k === i ? { ...s, title } : s)));
  const setUrl = (i: number, url: string) => onChange(value.map((s, k) => (k === i ? { ...s, url: url || undefined } : s)));
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="h-8" placeholder="Titre de la source" value={s.title} onChange={(e) => setTitle(i, e.target.value)} />
          <Input className="h-8 flex-1" placeholder="Lien (optionnel)" value={s.url ?? ''} onChange={(e) => setUrl(i, e.target.value)} />
          <button type="button" className="text-xs text-destructive" onClick={() => remove(i)}>Supprimer</button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>+ Ajouter une source</Button>
    </div>
  );
}
