'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { CropDocument, Variety } from '@/lib/api';

export interface CampaignFormValue { cropId: string; varietyId: string; season: string; startDate: string; status: 'ACTIVE' | 'CLOSED'; notes: string; }
export const emptyCampaign = (): CampaignFormValue => ({ cropId: '', varietyId: '', season: '', startDate: '', status: 'ACTIVE', notes: '' });
export const campaignToPayload = (v: CampaignFormValue) => ({
  cropId: v.cropId, varietyId: v.varietyId || undefined, season: v.season,
  startDate: v.startDate || undefined, status: v.status, notes: v.notes || undefined,
});

export function CampaignFields({ value, onChange, crops, varieties }: {
  value: CampaignFormValue; onChange: (v: CampaignFormValue) => void;
  crops: CropDocument[]; varieties: Variety[];
}) {
  const set = <K extends keyof CampaignFormValue>(k: K, val: CampaignFormValue[K]) => onChange({ ...value, [k]: val });
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Culture *</Label>
        <Select value={value.cropId} onValueChange={(v) => onChange({ ...value, cropId: v, varietyId: '' })}>
          <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
          <SelectContent>{crops.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Variété</Label>
        <Select value={value.varietyId} onValueChange={(v) => set('varietyId', v)}>
          <SelectTrigger><SelectValue placeholder="— aucune —" /></SelectTrigger>
          <SelectContent>{varieties.map((vr) => <SelectItem key={vr.id} value={vr.id}>{vr.name.fr ?? vr.id}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Saison *</Label><Input value={value.season} onChange={(e) => set('season', e.target.value)} placeholder="ex. Saison des pluies 2026" required /></div>
      <div className="space-y-1"><Label>Date de début</Label><Input type="date" value={value.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
      <div className="space-y-1">
        <Label>Statut</Label>
        <Select value={value.status} onValueChange={(v) => set('status', v as 'ACTIVE' | 'CLOSED')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ACTIVE">En cours</SelectItem><SelectItem value="CLOSED">Terminée</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Notes</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.notes} onChange={(e) => set('notes', e.target.value)} /></div>
    </div>
  );
}
