'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MinMaxRangeInput, type MinMax } from '@/components/MinMaxRangeInput';
import { TagListInput } from '@/components/TagListInput';
import { ImageGalleryUploader } from '@/components/ImageGalleryUploader';
import { CLIMATE_TYPE_LABELS, FERTILITY_LABELS, DRAINAGE_LABELS, MONTH_LABELS } from '@/lib/labels';
import type { ImageRef, Zone } from '@/lib/api';

export interface ZoneFormValue {
  name: string; country: string; code: string; region: string; description: string;
  climateType: string; koppen: string;
  altitude?: MinMax; annualRainfall?: MinMax;
  meanTemperature: string; meanHumidity: string;
  rainySeasonStart: string; rainySeasonEnd: string; drySeasonStart: string; drySeasonEnd: string;
  soilTypes: string[]; fertility: string; drainage: string;
  images: ImageRef[];
}

export function emptyZoneForm(): ZoneFormValue {
  return {
    name: '', country: '', code: '', region: '', description: '', climateType: '', koppen: '',
    altitude: undefined, annualRainfall: undefined, meanTemperature: '', meanHumidity: '',
    rainySeasonStart: '', rainySeasonEnd: '', drySeasonStart: '', drySeasonEnd: '',
    soilTypes: [], fertility: '', drainage: '', images: [],
  };
}

export function zoneFormFromZone(z: Zone): ZoneFormValue {
  const mm = (r?: { min: number; max: number; unit?: string }): MinMax | undefined =>
    r ? { min: r.min, max: r.max, unit: r.unit } : undefined;
  return {
    name: z.name ?? '', country: z.country ?? '', code: z.code ?? '', region: z.region ?? '',
    description: z.description?.fr ?? '', climateType: z.climateType ?? '', koppen: z.koppen ?? '',
    altitude: mm(z.altitude), annualRainfall: mm(z.annualRainfall),
    meanTemperature: z.meanTemperature != null ? String(z.meanTemperature) : '',
    meanHumidity: z.meanHumidity != null ? String(z.meanHumidity) : '',
    rainySeasonStart: z.rainySeasonStart ?? '', rainySeasonEnd: z.rainySeasonEnd ?? '',
    drySeasonStart: z.drySeasonStart ?? '', drySeasonEnd: z.drySeasonEnd ?? '',
    soilTypes: z.soilTypes ?? [], fertility: z.fertility ?? '', drainage: z.drainage ?? '',
    images: z.images ?? [],
  };
}

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
const rng = (r: MinMax | undefined, unit: string) =>
  r ? { min: r.min, optimal: Math.round((r.min + r.max) / 2), max: r.max, unit } : undefined;

export function zoneFormToPayload(v: ZoneFormValue) {
  return {
    name: { fr: v.name },
    country: v.country,
    code: v.code || undefined,
    region: v.region || undefined,
    description: v.description ? { fr: v.description } : undefined,
    climateType: v.climateType || undefined,
    koppen: v.koppen || undefined,
    altitude: rng(v.altitude, 'm'),
    annualRainfall: rng(v.annualRainfall, 'mm'),
    meanTemperature: num(v.meanTemperature),
    meanHumidity: num(v.meanHumidity),
    rainySeasonStart: v.rainySeasonStart || undefined,
    rainySeasonEnd: v.rainySeasonEnd || undefined,
    drySeasonStart: v.drySeasonStart || undefined,
    drySeasonEnd: v.drySeasonEnd || undefined,
    soilTypes: v.soilTypes.length ? v.soilTypes : undefined,
    fertility: v.fertility || undefined,
    drainage: v.drainage || undefined,
    images: v.images.map((i) => ({ key: i.key, caption: i.caption })),
  };
}

function MonthSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="— mois —" /></SelectTrigger>
        <SelectContent>
          {Object.entries(MONTH_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ZoneFields({ value, onChange }: { value: ZoneFormValue; onChange: (v: ZoneFormValue) => void }) {
  const set = <K extends keyof ZoneFormValue>(k: K, val: ZoneFormValue[K]) => onChange({ ...value, [k]: val });
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="text-sm font-semibold">Identification</p>
        <div className="space-y-1"><Label>Nom (fr) *</Label><Input value={value.name} onChange={(e) => set('name', e.target.value)} required /></div>
        <div className="space-y-1"><Label>Pays *</Label><Input placeholder="ex. BJ" value={value.country} onChange={(e) => set('country', e.target.value)} required /></div>
        <div className="space-y-1"><Label>Code (optionnel)</Label><Input value={value.code} onChange={(e) => set('code', e.target.value)} /></div>
        <div className="space-y-1"><Label>Région administrative</Label><Input value={value.region} onChange={(e) => set('region', e.target.value)} /></div>
        <div className="space-y-1"><Label>Description</Label><textarea className="min-h-16 w-full rounded-md border px-3 py-2 text-sm" value={value.description} onChange={(e) => set('description', e.target.value)} /></div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Climat</p>
        <div className="space-y-1">
          <Label>Type de climat</Label>
          <Select value={value.climateType} onValueChange={(v) => set('climateType', v)}>
            <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
            <SelectContent>
              {Object.entries(CLIMATE_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Classification de Köppen (optionnel)</Label><Input value={value.koppen} onChange={(e) => set('koppen', e.target.value)} /></div>
        <MinMaxRangeInput label="Altitude" unit="m" value={value.altitude} onChange={(v) => set('altitude', v)} />
        <MinMaxRangeInput label="Pluviométrie annuelle" unit="mm" value={value.annualRainfall} onChange={(v) => set('annualRainfall', v)} />
        <div className="space-y-1"><Label>Température moyenne (°C)</Label><Input type="number" className="w-32" value={value.meanTemperature} onChange={(e) => set('meanTemperature', e.target.value)} /></div>
        <div className="space-y-1"><Label>Humidité moyenne (%) (optionnel)</Label><Input type="number" className="w-32" value={value.meanHumidity} onChange={(e) => set('meanHumidity', e.target.value)} /></div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Saisons</p>
        <div className="grid grid-cols-2 gap-2">
          <MonthSelect label="Début saison des pluies" value={value.rainySeasonStart} onChange={(v) => set('rainySeasonStart', v)} />
          <MonthSelect label="Fin saison des pluies" value={value.rainySeasonEnd} onChange={(v) => set('rainySeasonEnd', v)} />
          <MonthSelect label="Début saison sèche" value={value.drySeasonStart} onChange={(v) => set('drySeasonStart', v)} />
          <MonthSelect label="Fin saison sèche" value={value.drySeasonEnd} onChange={(v) => set('drySeasonEnd', v)} />
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Sols dominants</p>
        <div className="space-y-1"><Label>Types de sols principaux</Label><TagListInput value={value.soilTypes} onChange={(v) => set('soilTypes', v)} placeholder="ex. Ferrugineux" /></div>
        <div className="space-y-1">
          <Label>Fertilité générale</Label>
          <Select value={value.fertility} onValueChange={(v) => set('fertility', v)}>
            <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
            <SelectContent>
              {Object.entries(FERTILITY_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Drainage</Label>
          <Select value={value.drainage} onValueChange={(v) => set('drainage', v)}>
            <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
            <SelectContent>
              {Object.entries(DRAINAGE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Photos</p>
        <ImageGalleryUploader value={value.images} onChange={(v) => set('images', v)} />
      </section>
    </div>
  );
}
