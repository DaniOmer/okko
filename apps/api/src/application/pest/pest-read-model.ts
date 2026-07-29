import { PestSnapshot } from '../../domain/pest/pest';
import { PestType } from '../../domain/pest/pest-type';
import { MediaImageJSON } from '../../domain/media/media-image';

export interface PestDocument {
  id: string;
  name: string;
  type: PestType;
  kind: PestSnapshot['kind'];
  scientificName?: string;
  family?: string;
  description?: Record<string, string>;
  updatedAt?: string;
  sources?: PestSnapshot['sources'];
  createdAt?: string;
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
  nuisanceTypes?: string[];
  reproductionMode?: string[];
  disseminationCapacity?: string;
  emergenceDepth?: PestSnapshot['emergenceDepth'];
  seedBankLongevity?: PestSnapshot['seedBankLongevity'];
  geographicAreas?: string[];
  favorableClimate?: Record<string, string>;
  knownPresence?: Record<string, string>;
  prevention?: Record<string, string>;
  biologicalControl?: Record<string, string>;
  predators?: string[];
  parasitoids?: string[];
  approvedProducts?: PestSnapshot['approvedProducts'];
  knownResistances?: Record<string, string>;
  firstSymptoms?: Record<string, string>;
  advancedSymptoms?: Record<string, string>;
  confusionRisk?: Record<string, string>;
  pathogen?: Record<string, string>;
  propagationModes?: string[];
  potentialLosses?: Record<string, string>;
  evolutionSpeed?: string;
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
  if (p.nuisanceTypes?.length) lines.push(`Nuisibilité : ${p.nuisanceTypes.join(', ')}`);
  if (p.reproductionMode?.length) lines.push(`Reproduction : ${p.reproductionMode.join(', ')}`);
  if (p.disseminationCapacity) lines.push(`Dissémination : ${p.disseminationCapacity}`);
  if (p.emergenceDepth) lines.push(`Profondeur de levée : ${p.emergenceDepth.min}–${p.emergenceDepth.max} cm`);
  if (p.seedBankLongevity) lines.push(`Banque de graines : ${p.seedBankLongevity.min}–${p.seedBankLongevity.max} ans`);
  if (p.geographicAreas?.length) lines.push(`Zones : ${p.geographicAreas.join(', ')}`);
  if (p.favorableClimate) lines.push(`Climat favorable : ${p.favorableClimate[locale] ?? p.favorableClimate['fr']}`);
  if (p.knownPresence) lines.push(`Présence connue : ${p.knownPresence[locale] ?? p.knownPresence['fr']}`);
  if (p.prevention) lines.push(`Prévention : ${p.prevention[locale] ?? p.prevention['fr']}`);
  if (p.biologicalControl) lines.push(`Lutte biologique : ${p.biologicalControl[locale] ?? p.biologicalControl['fr']}`);
  if (p.predators?.length) lines.push(`Prédateurs : ${p.predators.join(', ')}`);
  if (p.parasitoids?.length) lines.push(`Parasitoïdes : ${p.parasitoids.join(', ')}`);
  if (p.approvedProducts?.length) lines.push(`Produits homologués : ${p.approvedProducts.map((x) => x.name).join(', ')}`);
  if (p.knownResistances) lines.push(`Résistances : ${p.knownResistances[locale] ?? p.knownResistances['fr']}`);
  if (p.sources?.length) lines.push(`Sources : ${p.sources.map((s) => s.title).join(', ')}`);
  if (p.lifeCycle) lines.push(`Cycle de vie : ${p.lifeCycle[locale] ?? p.lifeCycle['fr']}`);
  if (p.cycleDurationDays) lines.push(`Durée du cycle : ${p.cycleDurationDays.min}–${p.cycleDurationDays.max} j`);
  if (p.generationsPerYear) lines.push(`Générations/an : ${p.generationsPerYear.min}–${p.generationsPerYear.max}`);
  if (p.pathogen) lines.push(`Agent pathogène : ${p.pathogen[locale] ?? p.pathogen['fr']}`);
  if (p.propagationModes?.length) lines.push(`Propagation : ${p.propagationModes.join(', ')}`);
  if (p.firstSymptoms) lines.push(`Premiers symptômes : ${p.firstSymptoms[locale] ?? p.firstSymptoms['fr']}`);
  if (p.advancedSymptoms) lines.push(`Symptômes avancés : ${p.advancedSymptoms[locale] ?? p.advancedSymptoms['fr']}`);
  if (p.confusionRisk) lines.push(`Risque de confusion : ${p.confusionRisk[locale] ?? p.confusionRisk['fr']}`);
  if (p.potentialLosses) lines.push(`Pertes potentielles : ${p.potentialLosses[locale] ?? p.potentialLosses['fr']}`);
  if (p.evolutionSpeed) lines.push(`Vitesse d'évolution : ${p.evolutionSpeed}`);
  return {
    id: p.id, name, type: p.type, kind: p.kind, scientificName: p.scientificName,
    family: p.family, description: p.description, updatedAt: p.updatedAt,
    sources: p.sources, createdAt: p.createdAt,
    symptoms: p.symptoms, images: p.images ?? [], notes: p.notes,
    metadata: p.metadata, serializedText: lines.join('\n'),
    lifeCycle: p.lifeCycle, cycleDurationDays: p.cycleDurationDays,
    developmentStages: p.developmentStages, generationsPerYear: p.generationsPerYear,
    activityPeriods: p.activityPeriods, favorableConditions: p.favorableConditions,
    attackedOrgans: p.attackedOrgans, damageTypes: p.damageTypes, harmfulnessLevel: p.harmfulnessLevel,
    nuisanceTypes: p.nuisanceTypes,
    reproductionMode: p.reproductionMode, disseminationCapacity: p.disseminationCapacity,
    emergenceDepth: p.emergenceDepth, seedBankLongevity: p.seedBankLongevity,
    geographicAreas: p.geographicAreas, favorableClimate: p.favorableClimate, knownPresence: p.knownPresence,
    prevention: p.prevention, biologicalControl: p.biologicalControl,
    predators: p.predators, parasitoids: p.parasitoids,
    approvedProducts: p.approvedProducts, knownResistances: p.knownResistances,
    firstSymptoms: p.firstSymptoms, advancedSymptoms: p.advancedSymptoms, confusionRisk: p.confusionRisk,
    pathogen: p.pathogen, propagationModes: p.propagationModes, potentialLosses: p.potentialLosses, evolutionSpeed: p.evolutionSpeed,
  };
}
