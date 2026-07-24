'use client';

export function ChipMultiSelect({ options, value, onChange }: { options: Record<string, string>; value: string[]; onChange: (v: string[]) => void }) {
  const order = Object.keys(options);
  const toggle = (code: string) => {
    const next = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
    onChange(order.filter((c) => next.includes(c)));
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.map((code) => (
        <button key={code} type="button" onClick={() => toggle(code)}
          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${value.includes(code) ? 'bg-[#245c27] text-white' : 'bg-[#f3f4f6] text-[#475569] hover:bg-[#eaf3ea]'}`}>
          {options[code]}
        </button>
      ))}
    </div>
  );
}
