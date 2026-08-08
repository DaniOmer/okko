'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface BeneficiaireFormValue { name: string; phone: string; notes: string; }
export const emptyBeneficiaire = (): BeneficiaireFormValue => ({ name: '', phone: '', notes: '' });
export const beneficiaireToPayload = (v: BeneficiaireFormValue) => ({ name: v.name, phone: v.phone || undefined, notes: v.notes || undefined });

export function BeneficiaireFields({ value, onChange }: { value: BeneficiaireFormValue; onChange: (v: BeneficiaireFormValue) => void }) {
  const set = <K extends keyof BeneficiaireFormValue>(k: K, val: BeneficiaireFormValue[K]) => onChange({ ...value, [k]: val });
  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label>Nom *</Label><Input value={value.name} onChange={(e) => set('name', e.target.value)} required /></div>
      <div className="space-y-1"><Label>Téléphone</Label><Input value={value.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      <div className="space-y-1"><Label>Notes</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    </div>
  );
}
