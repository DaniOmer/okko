'use client';

export function DatePicker({
  value,
  onChange,
  id,
}: {
  value: string;                    // ISO yyyy-MM-dd
  onChange: (iso: string) => void;
  placeholder?: string;             // conservé pour compat d'appel ; non utilisé par l'input natif
  id?: string;
}) {
  return (
    <input
      id={id}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  );
}
