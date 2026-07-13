'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/date-picker';
import { addPrice, updatePrice } from '@/lib/actions';

interface PriceInitial {
  id: string;
  market: string;
  periodStart: string;
  periodEnd: string;
  price: number;
  unit: string;
  currency: string;
}

export function PriceEditor({ cropId, initial }: { cropId: string; initial?: PriceInitial }) {
  const editing = !!initial;
  const [market, setMarket] = useState(initial?.market ?? '');
  const [periodStart, setPeriodStart] = useState(initial?.periodStart ?? '');
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [unit, setUnit] = useState(initial?.unit ?? 'FCFA/kg');
  const [currency, setCurrency] = useState(initial?.currency ?? 'XOF');

  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter un relevé de prix'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!periodStart) return;
            const body = { market, periodStart, periodEnd: periodEnd || undefined, price: Number(price), unit, currency };
            submit(async () => {
              if (editing) {
                await updatePrice(cropId, initial!.id, body);
              } else {
                await addPrice(cropId, body);
                setMarket(''); setPeriodStart(''); setPeriodEnd(''); setPrice(''); setUnit('FCFA/kg'); setCurrency('XOF');
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="price-market">Marché *</Label>
              <Input id="price-market" placeholder="ex. Dantokpa" value={market} onChange={(e)=>setMarket(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Début *</Label>
              <DatePicker value={periodStart} onChange={setPeriodStart} />
            </div>
            <div className="space-y-1">
              <Label>Fin (optionnelle)</Label>
              <DatePicker value={periodEnd} onChange={setPeriodEnd} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Prix, unité, devise</Label>
            <div className="flex gap-1">
              <Input className="w-24" placeholder="prix" value={price} onChange={(e)=>setPrice(e.target.value)} required />
              <Input className="w-24" placeholder="unité" value={unit} onChange={(e)=>setUnit(e.target.value)} />
              <Input className="w-20" placeholder="devise" value={currency} onChange={(e)=>setCurrency(e.target.value)} />
            </div>
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
