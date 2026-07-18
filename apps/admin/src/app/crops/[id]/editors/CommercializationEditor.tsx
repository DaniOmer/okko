'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PRODUCT_FORM_LABELS, SALE_UNIT_LABELS, OUTLET_LABELS } from '@/lib/labels';
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
  const [outlets, setOutlets] = useState<string[]>(initial?.outlets ?? []);

  function toggleUnit(code: string) {
    setSaleUnits((prev) =>
      prev.includes(code) ? prev.filter((u) => u !== code) : [...prev, code],
    );
  }

  const availableOutlets = Object.keys(OUTLET_LABELS).filter((c) => !outlets.includes(c));
  function addOutlet(code: string) { setOutlets((prev) => (prev.includes(code) ? prev : [...prev, code])); }
  function removeOutlet(code: string) { setOutlets((prev) => prev.filter((c) => c !== code)); }

  return (
    <EditorShell label={editing ? 'Modifier' : '+ Ajouter un produit'}>
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nouvelItem: CommercializationProduct = {
              form,
              saleUnits,
              outlets,
            };
            const next = editing
              ? current.map((it, i) => (i === editIndex ? nouvelItem : it))
              : [...current, nouvelItem];
            submit(async () => {
              await setCommercialization(cropId, next);
              if (!editing) {
                setForm('GRAIN');
                setSaleUnits([]);
                setOutlets([]);
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

          {/* Débouchés (sélection par codes) */}
          <div className="space-y-2">
            <Label>Débouchés</Label>
            <div className="flex flex-wrap gap-2">
              {outlets.map((code) => (
                <Badge key={code} variant="secondary" className="cursor-pointer" onClick={() => removeOutlet(code)}>
                  {OUTLET_LABELS[code] ?? code} ✕
                </Badge>
              ))}
              {outlets.length === 0 && <span className="text-xs text-muted-foreground">Aucun débouché</span>}
            </div>
            {availableOutlets.length > 0 && (
              <Select value="" onValueChange={addOutlet}>
                <SelectTrigger className="w-56"><SelectValue placeholder="+ Ajouter un débouché" /></SelectTrigger>
                <SelectContent>
                  {availableOutlets.map((code) => (
                    <SelectItem key={code} value={code}>{OUTLET_LABELS[code]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
