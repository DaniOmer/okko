import { PestSnapshot } from '../../domain/pest/pest';
import { PestType } from '../../domain/pest/pest-type';
import { MediaImageJSON } from '../../domain/media/media-image';

export interface PestDocument {
  id: string;
  name: string;
  type: PestType;
  scientificName?: string;
  family?: string;
  description?: Record<string, string>;
  updatedAt?: string;
  symptoms?: PestSnapshot['symptoms'];
  images: MediaImageJSON[];
  notes?: string;
  metadata: Record<string, unknown>;
  serializedText: string;
}

export function toPestDocument(p: PestSnapshot, locale = 'fr'): PestDocument {
  const name = p.name[locale] ?? p.name['fr'];
  const lines = [`# ${name} (${p.type})`];
  if (p.scientificName) lines.push(`Nom scientifique : ${p.scientificName}`);
  if (p.family) lines.push(`Famille : ${p.family}`);
  if (p.description) lines.push(p.description[locale] ?? p.description['fr']);
  if (p.symptoms) lines.push(`Symptômes : ${p.symptoms[locale] ?? p.symptoms['fr']}`);
  return {
    id: p.id, name, type: p.type, scientificName: p.scientificName,
    family: p.family, description: p.description, updatedAt: p.updatedAt,
    symptoms: p.symptoms, images: p.images ?? [], notes: p.notes,
    metadata: p.metadata, serializedText: lines.join('\n'),
  };
}
