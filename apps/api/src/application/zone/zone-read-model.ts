import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';

export interface ZoneDocument {
  id: string;
  name: string;
  country: string;
  koppen?: string;
  code?: string;
  region?: string;
  description?: Record<string, string>;
  climateType?: string;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
  annualRainfall?: ZoneSnapshot['annualRainfall'];
  altitude?: ZoneSnapshot['altitude'];
  notes?: string;
  metadata: Record<string, unknown>;
  serializedText: string;
}

export function toZoneDocument(z: ZoneSnapshot, locale = 'fr'): ZoneDocument {
  const name = z.name[locale] ?? z.name['fr'];
  const lines = [`# ${name} (${z.country})`];
  if (z.koppen) lines.push(`Köppen : ${z.koppen}`);
  if (z.climateType) lines.push(`Climat : ${z.climateType}`);
  if (z.region) lines.push(`Région : ${z.region}`);
  if (z.description) lines.push(z.description[locale] ?? z.description['fr']);
  if (z.meanTemperature != null) lines.push(`Température moyenne : ${z.meanTemperature} °C`);
  if (z.soilTypes?.length) lines.push(`Sols : ${z.soilTypes.join(', ')}`);
  if (z.annualRainfall) {
    const r = z.annualRainfall;
    lines.push(`Pluviométrie annuelle : ${r.min}–${r.optimal}–${r.max} ${r.unit}`);
  }
  if (z.notes) lines.push(z.notes);
  return {
    id: z.id, name, country: z.country, koppen: z.koppen,
    code: z.code, region: z.region, description: z.description, climateType: z.climateType,
    meanTemperature: z.meanTemperature, meanHumidity: z.meanHumidity,
    rainySeasonStart: z.rainySeasonStart, rainySeasonEnd: z.rainySeasonEnd,
    drySeasonStart: z.drySeasonStart, drySeasonEnd: z.drySeasonEnd,
    soilTypes: z.soilTypes, fertility: z.fertility, drainage: z.drainage,
    annualRainfall: z.annualRainfall, altitude: z.altitude, notes: z.notes,
    metadata: z.metadata, serializedText: lines.join('\n'),
  };
}
