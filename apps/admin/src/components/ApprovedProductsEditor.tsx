'use client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface ApprovedProductRow { name: string; country?: string; }

export function ApprovedProductsEditor({ value, onChange }: { value: ApprovedProductRow[]; onChange: (v: ApprovedProductRow[]) => void }) {
  const add = () => onChange([...value, { name: '' }]);
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const setName = (i: number, name: string) => onChange(value.map((p, k) => (k === i ? { ...p, name } : p)));
  const setCountry = (i: number, country: string) => onChange(value.map((p, k) => (k === i ? { ...p, country: country || undefined } : p)));
  return (
    <div className="space-y-2">
      {value.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="h-8" placeholder="Produit / matière active" value={p.name} onChange={(e) => setName(i, e.target.value)} />
          <Input className="h-8 w-28" placeholder="Pays" value={p.country ?? ''} onChange={(e) => setCountry(i, e.target.value)} />
          <button type="button" className="text-xs text-destructive" onClick={() => remove(i)}>Supprimer</button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>+ Ajouter un produit</Button>
    </div>
  );
}
