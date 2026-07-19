/** Une exigence chiffrée présentée en trois valeurs étiquetées : Minimum / Idéal / Maximum.
 *  Pensé pour être compris sans légende, y compris par un lecteur non expert. */
function Stat({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className={`flex-1 rounded-lg border p-2 text-center ${highlight ? 'border-transparent bg-[#eaf3ea]' : ''}`}>
      <div className={`text-[10.5px] uppercase tracking-wide ${highlight ? 'text-[#245c27]' : 'text-muted-foreground'}`}>{k}</div>
      <div className={`mt-0.5 text-lg font-bold ${highlight ? 'text-[#245c27]' : ''}`}>{v}</div>
    </div>
  );
}

export function StatRange({ label, min, optimal, max, unit }: { label: string; min: number; optimal: number; max: number; unit?: string }) {
  const u = unit ? ` ${unit}` : '';
  return (
    <div className="my-3">
      <div className="mb-1.5 text-sm font-medium">{label}</div>
      <div className="flex gap-2">
        <Stat k="Minimum" v={`${min}${u}`} />
        <Stat k="Idéal" v={`${optimal}${u}`} highlight />
        <Stat k="Maximum" v={`${max}${u}`} />
      </div>
    </div>
  );
}
