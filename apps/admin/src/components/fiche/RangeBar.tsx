import { optimalPercent } from './fiche-ui';

export function RangeBar({ label, min, optimal, max, unit }: { label: string; min: number; optimal: number; max: number; unit?: string }) {
  const pct = optimalPercent(min, optimal, max);
  return (
    <div className="my-2">
      <div className="mb-1 text-sm text-muted-foreground">{label}{unit ? ` (${unit})` : ''}</div>
      <div className="relative h-2 rounded-md" style={{ background: 'linear-gradient(90deg,#f1c40f22,#2e7d3244,#f1c40f22)' }}>
        <div className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-[#2e7d32]"
             style={{ left: `${pct}%`, boxShadow: '0 0 0 1px #2e7d32' }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{min} min</span><span>{optimal} optimal</span><span>{max} max</span>
      </div>
    </div>
  );
}
