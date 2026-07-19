export interface TimelineStep { key: string; j: string; label: string; sowing?: boolean; chips?: string[]; }

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="mt-2 flex items-start overflow-x-auto pb-1">
      {steps.map((s) => (
        <div key={s.key} className="relative min-w-[96px] pt-[18px] text-center">
          <span className="absolute left-0 right-0 top-[6px] h-[2px] bg-[#e6e8eb]" />
          <span className={`absolute left-1/2 top-[2px] -translate-x-1/2 rounded-full ${s.sowing ? 'h-3 w-3 bg-[#b45309]' : 'h-2.5 w-2.5 bg-[#2e7d32]'}`} />
          <div className="text-[11px] text-muted-foreground">{s.j}</div>
          <div className="text-xs font-semibold">{s.label}</div>
          {s.chips && s.chips.length > 0 && (
            <div className="mt-0.5 flex flex-wrap justify-center gap-1">
              {s.chips.map((c, i) => <span key={i} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">{c}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
