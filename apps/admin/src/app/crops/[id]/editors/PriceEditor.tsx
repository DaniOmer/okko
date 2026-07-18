'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ShadcnDatePicker } from '@/components/shadcn-date-picker';
import { PRODUCT_FORM_LABELS, SALE_UNIT_LABELS } from '@/lib/labels';
import { addPrice, updatePrice } from '@/lib/actions';
import type { CommercializationProduct } from '@/lib/api';

interface PriceInitial {
  id: string;
  form: string;
  market: string;
  periodStart: string;
  periodEnd: string;
  price: number;
  unit: string;
  currency: string;
}

export function PriceEditor({ cropId, commercialization, initial }: {
  cropId: string;
  commercialization: CommercializationProduct[];
  initial?: PriceInitial;
}) {
  const editing = !!initial;
  const forms = Array.from(new Set(commercialization.map((p) => p.form)));
  const unitsFor = (f: string) => Array.from(new Set(commercialization.filter((p) => p.form === f).flatMap((p) => p.saleUnits)));

  const [form, setForm] = useState(initial?.form ?? forms[0] ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? unitsFor(initial?.form ?? forms[0] ?? '')[0] ?? '');
  const [market, setMarket] = useState(initial?.market ?? '');
  const [periodStart, setPeriodStart] = useState(initial?.periodStart ?? '');
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'XOF');

  function onFormChange(f: string) {
    setForm(f);
    setUnit(unitsFor(f)[0] ?? '');
  }

  if (commercialization.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Déclare d&apos;abord la commercialisation (au moins une forme) pour saisir des prix.
      </p>
    );
  }

  const units = unitsFor(form);

  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter un relevé de prix'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!periodStart || !form || !unit) return;
            const body = { form, market, periodStart, periodEnd: periodEnd || undefined, price: Number(price), unit, currency };
            submit(async () => {
              if (editing) {
                await updatePrice(cropId, initial!.id, body);
              } else {
                await addPrice(cropId, body);
                setMarket(''); setPeriodStart(''); setPeriodEnd(''); setPrice('');
                setForm(forms[0] ?? ''); setUnit(unitsFor(forms[0] ?? '')[0] ?? ''); setCurrency('XOF');
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>Forme *</Label>
              <Select value={form} onValueChange={onFormChange}>
                <SelectTrigger><SelectValue placeholder="Forme" /></SelectTrigger>
                <SelectContent>
                  {forms.map((f) => (
                    <SelectItem key={f} value={f}>{PRODUCT_FORM_LABELS[f] ?? f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label>Unité *</Label>
              <Select value={unit} onValueChange={setUnit} disabled={units.length === 0}>
                <SelectTrigger><SelectValue placeholder="Unité" /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>{SALE_UNIT_LABELS[u] ?? u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="price-market">Marché *</Label>
              <Input id="price-market" placeholder="ex. Dantokpa" value={market} onChange={(e)=>setMarket(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Début *</Label>
              <ShadcnDatePicker value={periodStart} onChange={setPeriodStart} />
            </div>
            <div className="space-y-1">
              <Label>Fin (optionnelle)</Label>
              <ShadcnDatePicker value={periodEnd} onChange={setPeriodEnd} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Prix &amp; devise</Label>
            <div className="flex gap-1">
              <Input className="w-28" placeholder="prix" value={price} onChange={(e)=>setPrice(e.target.value)} required />
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
