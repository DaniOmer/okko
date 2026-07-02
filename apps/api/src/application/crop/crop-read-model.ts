import { CropSnapshot } from '../../domain/crop/crop';

export interface CropDocument {
  id: string;
  name: string;
  scientificName: string;
  family: string;
  cycleType: string;
  status: string;
  version: number;
  metadata: Record<string, unknown>;
  serializedText: string;
}

export function toCropDocument(s: CropSnapshot, locale = 'fr'): CropDocument {
  const name = s.commonNames[locale] ?? s.commonNames['fr'];
  const serializedText = [
    `# ${name} (${s.scientificName})`,
    `Famille : ${s.family}`,
    `Type de cycle : ${s.cycleType}`,
    `Statut : ${s.status} (version ${s.version})`,
  ].join('\n');
  return {
    id: s.id, name, scientificName: s.scientificName, family: s.family,
    cycleType: s.cycleType, status: s.status, version: s.version,
    metadata: s.metadata, serializedText,
  };
}
