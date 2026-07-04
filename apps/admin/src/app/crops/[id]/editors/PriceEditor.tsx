'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
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
            submit(() => addPrice(cropId, { market, date, price: Number(price), unit, currency }));
          }}
          className="space-y-2 text-sm"
        >
          <div className="flex gap-1">
            <input className="flex-1 border p-1" placeholder="Marché" value={market} onChange={(e)=>setMarket(e.target.value)} required />
            <input className="w-32 border p-1" type="date" value={date} onChange={(e)=>setDate(e.target.value)} required />
          </div>
          <div className="flex gap-1">
            <input className="w-24 border p-1" placeholder="prix" value={price} onChange={(e)=>setPrice(e.target.value)} required />
            <input className="w-24 border p-1" placeholder="unité" value={unit} onChange={(e)=>setUnit(e.target.value)} />
            <input className="w-20 border p-1" placeholder="devise" value={currency} onChange={(e)=>setCurrency(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded bg-green-700 px-3 py-1 text-white">Ajouter</button>
            <button type="button" onClick={close}>Annuler</button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
