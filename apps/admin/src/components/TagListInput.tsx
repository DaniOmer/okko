'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function TagListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (!t || value.includes(t)) { setDraft(''); return; }
    onChange([...value, t]);
    setDraft('');
  };
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ea] px-2.5 py-1 text-xs text-[#245c27]">
              {t}
              <button type="button" aria-label={`Retirer ${t}`} className="text-[#245c27]/60 hover:text-[#245c27]" onClick={() => remove(i)}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          className="h-8"
          placeholder={placeholder ?? 'Ajouter…'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>Ajouter</Button>
      </div>
    </div>
  );
}
