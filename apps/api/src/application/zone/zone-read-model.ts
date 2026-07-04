import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';

export interface ZoneDocument {
  id: string;
  name: string;
  country: string;
  koppen?: string;
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
  if (z.annualRainfall) {
    const r = z.annualRainfall;
    lines.push(`Pluviométrie annuelle : ${r.min}–${r.optimal}–${r.max} ${r.unit}`);
  }
  if (z.notes) lines.push(z.notes);
  return {
    id: z.id, name, country: z.country, koppen: z.koppen,
    annualRainfall: z.annualRainfall, altitude: z.altitude, notes: z.notes,
    metadata: z.metadata, serializedText: lines.join('\n'),
  };
}
