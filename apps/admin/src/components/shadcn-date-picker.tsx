'use client';
import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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

export function ShadcnDatePicker({ value, onChange, id }: { value: string; onChange: (iso: string) => void; id?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" size="sm" className="w-36 justify-start font-normal">
          {labelFr(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isoToDate(value)}
          onSelect={(d?: Date) => { if (d) onChange(dateToIso(d)); setOpen(false); }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
