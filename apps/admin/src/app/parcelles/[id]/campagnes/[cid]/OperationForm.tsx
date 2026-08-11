'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ImageGalleryUploader } from '@/components/ImageGalleryUploader';
import { OPERATION_TYPE_LABELS } from '@/lib/labels';
import type { OperationInput, ImageRef } from '@/lib/api';

type InputRow = OperationInput & { _k?: string };
export interface OperationFormValue { type: string; date: string; inputs: InputRow[]; laborCost: string; notes: string; photos: ImageRef[]; lat: string; lng: string; }
export const emptyOperation = (): OperationFormValue => ({ type: 'PLANTING', date: '', inputs: [], laborCost: '', notes: '', photos: [], lat: '', lng: '' });
const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
export const operationToPayload = (v: OperationFormValue) => ({
  type: v.type, date: v.date,
  inputs: v.inputs.filter((i) => i.product.trim() !== '').map((i) => ({ product: i.product, quantity: i.quantity, unit: i.unit, cost: i.cost })),
  laborCost: num(v.laborCost),
  notes: v.notes || undefined,
  photos: v.photos.map((p) => ({ key: p.key, caption: p.caption })),
  gpsLat: num(v.lat),
  gpsLng: num(v.lng),
});

export function OperationFields({ value, onChange }: { value: OperationFormValue; onChange: (v: OperationFormValue) => void }) {
  const [geoError, setGeoError] = useState<string | null>(null);
  const set = <K extends keyof OperationFormValue>(k: K, val: OperationFormValue[K]) => onChange({ ...value, [k]: val });
  const setInput = (i: number, patch: Partial<OperationInput>) => set('inputs', value.inputs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const capture = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoError("Géolocalisation indisponible sur cet appareil."); return; }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ ...value, lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }),
      () => setGeoError("Position indisponible (autorisation refusée ?)."),
    );
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Type d&apos;opération *</Label>
        <Select value={value.type} onValueChange={(v) => set('type', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(OPERATION_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Date *</Label><Input type="date" value={value.date} onChange={(e) => set('date', e.target.value)} required /></div>
      <div className="space-y-1">
        <Label>Intrants</Label>
        <div className="space-y-2">
          {value.inputs.map((inp, i) => (
            <div key={inp._k ?? i} className="flex gap-1 items-center">
              <Input className="flex-1" placeholder="produit" value={inp.product} onChange={(e) => setInput(i, { product: e.target.value })} />
              <Input className="w-20" type="number" placeholder="qté" value={inp.quantity ?? ''} onChange={(e) => setInput(i, { quantity: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Input className="w-16" placeholder="unité" value={inp.unit ?? ''} onChange={(e) => setInput(i, { unit: e.target.value || undefined })} />
              <Input className="w-20" type="number" placeholder="coût" value={inp.cost ?? ''} onChange={(e) => setInput(i, { cost: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <Button type="button" variant="ghost" size="sm" onClick={() => set('inputs', value.inputs.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set('inputs', [...value.inputs, { product: '', _k: crypto.randomUUID() }])}>+ Ajouter un intrant</Button>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Photos</Label>
        <ImageGalleryUploader value={value.photos} onChange={(v) => set('photos', v)} />
      </div>
      <div className="space-y-1">
        <Label>Position GPS</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-32" placeholder="latitude" value={value.lat} onChange={(e) => set('lat', e.target.value)} />
          <Input className="w-32" placeholder="longitude" value={value.lng} onChange={(e) => set('lng', e.target.value)} />
          <Button type="button" variant="outline" size="sm" onClick={capture}>📍 Capturer ma position</Button>
        </div>
        {geoError && <p className="text-xs text-destructive">{geoError}</p>}
      </div>
      <div className="space-y-1"><Label>Coût main d&apos;œuvre</Label><Input className="w-32" type="number" value={value.laborCost} onChange={(e) => set('laborCost', e.target.value)} /></div>
      <div className="space-y-1"><Label>Notes</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    </div>
  );
}
