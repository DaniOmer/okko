'use client';
import { MONTH_LABELS } from '@/lib/labels';

export function MonthMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const order = Object.keys(MONTH_LABELS);
  const toggle = (code: string) => {
    const next = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
    onChange(order.filter((c) => next.includes(c)));   // keep calendar order
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.map((code) => (
        <button key={code} type="button" onClick={() => toggle(code)}
          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${value.includes(code) ? 'bg-[#245c27] text-white' : 'bg-[#f3f4f6] text-[#475569] hover:bg-[#eaf3ea]'}`}>
          {MONTH_LABELS[code].slice(0, 4)}
        </button>
      ))}
    </div>
  );
}
