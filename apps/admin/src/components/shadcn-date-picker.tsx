'use client';
import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function labelFr(iso: string): string {
  if (!iso) return 'Choisir…';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Sélecteur de date shadcn (Calendar) SANS Popover radix porté :
 * le panneau est rendu inline dans le DOM du parent, pour ne pas être vu
 * comme un « clic extérieur » par un Dialog radix englobant (sinon la modale
 * se fermerait à chaque sélection de jour).
 */
export function ShadcnDatePicker({ value, onChange, id }: { value: string; onChange: (iso: string) => void; id?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <Button
        id={id}
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start font-normal"
        onClick={() => setOpen((o) => !o)}
      >
        {labelFr(value)}
      </Button>
      {open && (
        <>
          {/* fond cliquable pour fermer, à l'intérieur du sous-arbre du Dialog */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md">
            <Calendar
              mode="single"
              selected={isoToDate(value)}
              onSelect={(d?: Date) => { if (d) onChange(dateToIso(d)); setOpen(false); }}
              initialFocus
            />
          </div>
        </>
      )}
    </div>
  );
}
