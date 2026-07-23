'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MinMaxRangeInput, type MinMax } from './MinMaxRangeInput';

export interface DevStage { name: Record<string, string>; durationDays?: MinMax; }

export function DevelopmentStagesEditor({ value, onChange }: { value: DevStage[]; onChange: (v: DevStage[]) => void }) {
  const add = () => onChange([...value, { name: { fr: '' } }]);
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= value.length) return;
    const n = [...value]; [n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };
  const setName = (i: number, fr: string) => onChange(value.map((s, k) => (k === i ? { ...s, name: { fr } } : s)));
  const setDur = (i: number, durationDays: MinMax | undefined) => onChange(value.map((s, k) => (k === i ? { ...s, durationDays } : s)));
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="rounded-md border p-2 space-y-2">
          <div className="flex items-center gap-2">
            <Input className="h-8" placeholder="Nom du stade (ex. Larve)" value={s.name.fr ?? ''} onChange={(e) => setName(i, e.target.value)} />
            <button type="button" aria-label="Monter" className="text-xs text-muted-foreground" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" aria-label="Descendre" className="text-xs text-muted-foreground" onClick={() => move(i, 1)} disabled={i === value.length - 1}>↓</button>
            <button type="button" className="text-xs text-destructive" onClick={() => remove(i)}>Supprimer</button>
          </div>
          <MinMaxRangeInput label="Durée" unit="j" value={s.durationDays} onChange={(v) => setDur(i, v)} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>+ Ajouter un stade</Button>
    </div>
  );
}
