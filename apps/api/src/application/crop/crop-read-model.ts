import { CropSnapshot } from '../../domain/crop/crop';
import { VarietySnapshot } from '../../domain/crop/variety';
import { CropZoneView } from '../zone/list-crop-zones.use-case';

export interface CropDocument {
  id: string;
  name: string;
  scientificName: string;
  family: string;
  cycleType: string;
  status: string;
  version: number;
  metadata: Record<string, unknown>;
  climatic?: CropSnapshot['climatic'];
  edaphic?: CropSnapshot['edaphic'];
  varieties: VarietySnapshot[];
  zones: CropZoneView[];
  serializedText: string;
}

export function toCropDocument(
  s: CropSnapshot,
  locale = 'fr',
  varieties: VarietySnapshot[] = [],
  zones: CropZoneView[] = [],
): CropDocument {
  const name = s.commonNames[locale] ?? s.commonNames['fr'];
  const lines = [
    `# ${name} (${s.scientificName})`,
    `Famille : ${s.family}`,
    `Type de cycle : ${s.cycleType}`,
    `Statut : ${s.status} (version ${s.version})`,
  ];
  if (s.climatic?.temperature) {
    const t = s.climatic.temperature;
    lines.push(`Température : ${t.min}–${t.optimal}–${t.max} ${t.unit}`);
  }
  if (s.climatic?.rainfall) {
    const r = s.climatic.rainfall;
    lines.push(`Pluviométrie : ${r.min}–${r.optimal}–${r.max} ${r.unit}`);
  }
  if (s.edaphic?.ph) {
    const p = s.edaphic.ph;
    lines.push(`pH du sol : ${p.min}–${p.optimal}–${p.max}`);
  }
  if (varieties.length > 0) {
    lines.push(`Variétés : ${varieties.map((v) => v.name[locale] ?? v.name['fr']).join(', ')}`);
  }
  if (zones.length > 0) {
    lines.push(`Zones : ${zones.map((z) => `${z.zoneName[locale] ?? z.zoneName['fr']} (${z.rating})`).join(', ')}`);
  }
  return {
    id: s.id, name, scientificName: s.scientificName, family: s.family,
    cycleType: s.cycleType, status: s.status, version: s.version,
    metadata: s.metadata, climatic: s.climatic, edaphic: s.edaphic,
    varieties, zones, serializedText: lines.join('\n'),
  };
}
