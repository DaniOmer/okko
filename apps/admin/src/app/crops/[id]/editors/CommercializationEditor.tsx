'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PRODUCT_FORM_LABELS, SALE_UNIT_LABELS } from '@/lib/labels';
import { setCommercialization } from '@/lib/actions';
import type { CommercializationProduct } from '@/lib/api';

export function CommercializationEditor({
  cropId,
  current,
  editIndex,
}: {
  cropId: string;
  current: CommercializationProduct[];
  editIndex?: number;
}) {
  const editing = editIndex != null;
  const initial = editing ? current[editIndex!] : undefined;

  const [form, setForm] = useState(initial?.form ?? 'GRAIN');
  const [saleUnits, setSaleUnits] = useState<string[]>(initial?.saleUnits ?? []);
  const [outlets, setOutlets] = useState<string[]>(initial?.outlets?.length ? initial.outlets : ['']);

  function toggleUnit(code: string) {
    setSaleUnits((prev) =>
      prev.includes(code) ? prev.filter((u) => u !== code) : [...prev, code],
    );
  }

  function addOutlet() {
    setOutlets((prev) => [...prev, '']);
  }

  function removeOutlet(idx: number) {
    setOutlets((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateOutlet(idx: number, value: string) {
    setOutlets((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter un produit'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nouvelItem: CommercializationProduct = {
              form,
              saleUnits,
              outlets: outlets.map((o) => o.trim()).filter(Boolean),
            };
            const next = editing
              ? current.map((it, i) => (i === editIndex ? nouvelItem : it))
              : [...current, nouvelItem];
            submit(async () => {
              await setCommercialization(cropId, next);
              if (!editing) {
                setForm('GRAIN');
                setSaleUnits([]);
                setOutlets(['']);
              }
            });
          }}
          className="space-y-3 text-sm"
        >
          {/* Forme du produit */}
          <div className="space-y-1">
            <Label>Forme du produit</Label>
            <Select value={form} onValueChange={setForm}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRODUCT_FORM_LABELS).map(([code, fr]) => (
                  <SelectItem key={code} value={code}>{fr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unités de vente (multi-sélection par boutons) */}
          <div className="space-y-1">
            <Label>Unités de vente</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SALE_UNIT_LABELS).map(([code, fr]) => (
                <Button
                  key={code}
                  type="button"
                  size="sm"
                  variant={saleUnits.includes(code) ? 'default' : 'outline'}
                  onClick={() => toggleUnit(code)}
                >
                  {fr}
                </Button>
              ))}
            </div>
          </div>

          {/* Débouchés (liste de chaînes répétable) */}
          <div className="space-y-2">
            <Label>Débouchés</Label>
            {outlets.map((outlet, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="ex. Marché local, Export…"
                  value={outlet}
                  onChange={(e) => updateOutlet(idx, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOutlet(idx)}
                  disabled={outlets.length === 1}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addOutlet}>
              + débouché
            </Button>
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
