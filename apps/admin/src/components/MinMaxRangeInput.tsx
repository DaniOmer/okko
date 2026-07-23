'use client';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface MinMax { min: number; max: number; unit?: string; }

export function MinMaxRangeInput({ label, unit, value, onChange }: {
  label: string; unit?: string; value?: MinMax; onChange: (v: MinMax | undefined) => void;
}) {
  const [min, setMin] = useState(value?.min?.toString() ?? '');
  const [max, setMax] = useState(value?.max?.toString() ?? '');
  useEffect(() => {
    setMin(value?.min?.toString() ?? '');
    setMax(value?.max?.toString() ?? '');
  }, [value?.min, value?.max]);
  function emit(nextMin: string, nextMax: string) {
    const mn = Number(nextMin), mx = Number(nextMax);
    if (nextMin.trim() !== '' && nextMax.trim() !== '' && Number.isFinite(mn) && Number.isFinite(mx)) {
      onChange({ min: mn, max: mx, ...(unit ? { unit } : {}) });
    } else {
      onChange(undefined);
    }
  }
  return (
    <div className="space-y-1">
      <Label>{label}{unit ? ` (${unit})` : ''}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" className="h-8 w-24" placeholder="min" value={min}
          onChange={(e) => { setMin(e.target.value); emit(e.target.value, max); }} />
        <span className="text-muted-foreground">–</span>
        <Input type="number" className="h-8 w-24" placeholder="max" value={max}
          onChange={(e) => { setMax(e.target.value); emit(min, e.target.value); }} />
      </div>
    </div>
  );
}
