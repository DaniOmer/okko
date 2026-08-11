'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { Beneficiary, Zone } from '@/lib/api';

export interface ParcelleFormValue { name: string; beneficiaryId: string; zoneId: string; gpsLat: string; gpsLng: string; locality: string; areaHectares: string; notes: string; }
export const emptyParcelle = (): ParcelleFormValue => ({ name: '', beneficiaryId: '', zoneId: '', gpsLat: '', gpsLng: '', locality: '', areaHectares: '', notes: '' });
const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
export const parcelleToPayload = (v: ParcelleFormValue) => ({
  name: v.name,
  beneficiaryId: v.beneficiaryId || undefined,
  zoneId: v.zoneId || undefined,
  gpsLat: num(v.gpsLat), gpsLng: num(v.gpsLng),
  locality: v.locality || undefined,
  areaHectares: num(v.areaHectares),
  notes: v.notes || undefined,
});

export function ParcelleFields({ value, onChange, beneficiaries, zones }: {
  value: ParcelleFormValue; onChange: (v: ParcelleFormValue) => void;
  beneficiaries: Beneficiary[]; zones: Zone[];
}) {
  const set = <K extends keyof ParcelleFormValue>(k: K, val: ParcelleFormValue[K]) => onChange({ ...value, [k]: val });
  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label>Nom de la parcelle *</Label><Input value={value.name} onChange={(e) => set('name', e.target.value)} required /></div>
      <div className="space-y-1">
        <Label>Bénéficiaire</Label>
        <Select value={value.beneficiaryId} onValueChange={(v) => set('beneficiaryId', v === '__none__' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="— aucun —" /></SelectTrigger>
          <SelectContent><SelectItem value="__none__">— aucun —</SelectItem>{beneficiaries.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Zone</Label>
        <Select value={value.zoneId} onValueChange={(v) => set('zoneId', v === '__none__' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="— aucune —" /></SelectTrigger>
          <SelectContent><SelectItem value="__none__">— aucune —</SelectItem>{zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Surface (ha)</Label><Input type="number" className="w-40" value={value.areaHectares} onChange={(e) => set('areaHectares', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>GPS latitude</Label><Input type="number" value={value.gpsLat} onChange={(e) => set('gpsLat', e.target.value)} /></div>
        <div className="space-y-1"><Label>GPS longitude</Label><Input type="number" value={value.gpsLng} onChange={(e) => set('gpsLng', e.target.value)} /></div>
      </div>
      <div className="space-y-1"><Label>Localité</Label><Input value={value.locality} onChange={(e) => set('locality', e.target.value)} /></div>
      <div className="space-y-1"><Label>Notes</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    </div>
  );
}
