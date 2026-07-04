export function CompletenessRing({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(hsl(var(--primary)) ${p}%, hsl(var(--muted)) ${p}%)` }}
      aria-label={`Complétude ${p}%`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-xs font-bold text-primary">
        {p}%
      </div>
    </div>
  );
}
