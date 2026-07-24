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
  lifeCycle?: Record<string, string>;
  cycleDurationDays?: PestSnapshot['cycleDurationDays'];
  developmentStages?: PestSnapshot['developmentStages'];
  generationsPerYear?: PestSnapshot['generationsPerYear'];
  activityPeriods?: string[];
  favorableConditions?: PestSnapshot['favorableConditions'];
  attackedOrgans?: string[];
  damageTypes?: string[];
  harmfulnessLevel?: string;
  geographicAreas?: string[];
  favorableClimate?: Record<string, string>;
  knownPresence?: Record<string, string>;
}

export function toPestDocument(p: PestSnapshot, locale = 'fr'): PestDocument {
  const name = p.name[locale] ?? p.name['fr'];
  const lines = [`# ${name} (${p.type})`];
  if (p.scientificName) lines.push(`Nom scientifique : ${p.scientificName}`);
  if (p.family) lines.push(`Famille : ${p.family}`);
  if (p.description) lines.push(p.description[locale] ?? p.description['fr']);
  if (p.symptoms) lines.push(`Symptômes : ${p.symptoms[locale] ?? p.symptoms['fr']}`);
  if (p.attackedOrgans?.length) lines.push(`Organes attaqués : ${p.attackedOrgans.join(', ')}`);
  if (p.damageTypes?.length) lines.push(`Types de dégâts : ${p.damageTypes.join(', ')}`);
  if (p.harmfulnessLevel) lines.push(`Nuisibilité : ${p.harmfulnessLevel}`);
  if (p.geographicAreas?.length) lines.push(`Zones : ${p.geographicAreas.join(', ')}`);
  if (p.favorableClimate) lines.push(`Climat favorable : ${p.favorableClimate[locale] ?? p.favorableClimate['fr']}`);
  if (p.knownPresence) lines.push(`Présence connue : ${p.knownPresence[locale] ?? p.knownPresence['fr']}`);
  if (p.lifeCycle) lines.push(`Cycle de vie : ${p.lifeCycle[locale] ?? p.lifeCycle['fr']}`);
  if (p.cycleDurationDays) lines.push(`Durée du cycle : ${p.cycleDurationDays.min}–${p.cycleDurationDays.max} j`);
  if (p.generationsPerYear) lines.push(`Générations/an : ${p.generationsPerYear.min}–${p.generationsPerYear.max}`);
  return {
    id: p.id, name, type: p.type, scientificName: p.scientificName,
    family: p.family, description: p.description, updatedAt: p.updatedAt,
    symptoms: p.symptoms, images: p.images ?? [], notes: p.notes,
    metadata: p.metadata, serializedText: lines.join('\n'),
    lifeCycle: p.lifeCycle, cycleDurationDays: p.cycleDurationDays,
    developmentStages: p.developmentStages, generationsPerYear: p.generationsPerYear,
    activityPeriods: p.activityPeriods, favorableConditions: p.favorableConditions,
    attackedOrgans: p.attackedOrgans, damageTypes: p.damageTypes, harmfulnessLevel: p.harmfulnessLevel,
    geographicAreas: p.geographicAreas, favorableClimate: p.favorableClimate, knownPresence: p.knownPresence,
  };
}
