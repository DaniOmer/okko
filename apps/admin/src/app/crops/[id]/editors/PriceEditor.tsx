'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/date-picker';
import { addPrice } from '../../../../lib/api';

export function PriceEditor({ cropId }: { cropId: string }) {
  const [market, setMarket] = useState(''); const [date, setDate] = useState('');
  const [price, setPrice] = useState(''); const [unit, setUnit] = useState('FCFA/kg'); const [currency, setCurrency] = useState('XOF');
  return (
    <EditorShell label="+ Ajouter un relevé de prix">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!date) return;
            submit(async () => {
              await addPrice(cropId, { market, date, price: Number(price), unit, currency });
              setMarket(''); setDate(''); setPrice(''); setUnit('FCFA/kg'); setCurrency('XOF');
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
              <Label>Date *</Label>
              <DatePicker value={date} onChange={setDate} />
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
            <Button type="submit" size="sm" disabled={busy}>Ajouter</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
