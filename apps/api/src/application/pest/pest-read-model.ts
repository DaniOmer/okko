import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';
import { PestType } from '../../domain/pest/pest-type';

export interface PestDocument {
  id: string;
  name: string;
  type: PestType;
  scientificName?: string;
  symptoms?: PestDiseaseSnapshot['symptoms'];
  photos: string[];
  notes?: string;
  metadata: Record<string, unknown>;
  serializedText: string;
}

export function toPestDocument(p: PestDiseaseSnapshot, locale = 'fr'): PestDocument {
  const name = p.name[locale] ?? p.name['fr'];
  const lines = [`# ${name} (${p.type})`];
  if (p.scientificName) lines.push(`Nom scientifique : ${p.scientificName}`);
  if (p.symptoms) lines.push(`Symptômes : ${p.symptoms[locale] ?? p.symptoms['fr']}`);
  return {
    id: p.id, name, type: p.type, scientificName: p.scientificName,
    symptoms: p.symptoms, photos: p.photos, notes: p.notes,
    metadata: p.metadata, serializedText: lines.join('\n'),
  };
}
