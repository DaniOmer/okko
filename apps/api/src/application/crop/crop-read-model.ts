import { CropSnapshot } from '../../domain/crop/crop';
import { VarietySnapshot } from '../../domain/crop/variety';
import { CropZoneView } from '../zone/list-crop-zones.use-case';
import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';
import { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';
import { CropPestView } from '../pest/list-crop-pests.use-case';
import { PricePointSnapshot } from '../../domain/price/price-point';
import { NutrientRequirementJSON } from '../../domain/crop/nutrient-requirement';
import { YieldReferenceJSON } from '../../domain/crop/yield-reference';
import { computeCompleteness, CompletenessReport } from './crop-completeness';

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
  phenology: PhenologicalStageJSON[];
  croppingWindows: CroppingWindowSnapshot[];
  pests: CropPestView[];
  nutrition: NutrientRequirementJSON[];
  yields: YieldReferenceJSON[];
  prices: PricePointSnapshot[];
  completeness: CompletenessReport;
  serializedText: string;
  hasUnpublishedChanges: boolean;
  hasPublishedVersion: boolean;
  publishedVersion: number;
}

export interface ToCropDocumentOptions {
  locale?: string;
  varieties?: VarietySnapshot[];
  zones?: CropZoneView[];
  windows?: CroppingWindowSnapshot[];
  pests?: CropPestView[];
  prices?: PricePointSnapshot[];
}

export function toCropDocument(s: CropSnapshot, opts: ToCropDocumentOptions = {}): CropDocument {
  const locale = opts.locale ?? 'fr';
  const varieties = opts.varieties ?? [];
  const zones = opts.zones ?? [];
  const windows = opts.windows ?? [];
  const pests = opts.pests ?? [];
  const prices = opts.prices ?? [];
  const nutrition = s.nutrition ?? [];
  const yields = s.yields ?? [];
  const name = s.commonNames[locale] ?? s.commonNames['fr'];
  const phenology = s.phenology ?? [];
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
  if (phenology.length > 0) {
    lines.push(`Phénologie : ${phenology.map((p) => `${p.name[locale] ?? p.name['fr']} (J${p.startDay}-${p.endDay})`).join(', ')}`);
  }
  if (windows.length > 0) {
    lines.push(`Fenêtres : ${windows.map((w) => w.season).join(', ')}`);
  }
  if (pests.length > 0) {
    lines.push(`Ravageurs : ${pests.map((p) => `${p.pestName[locale] ?? p.pestName['fr']} (${p.susceptibility})`).join(', ')}`);
  }
  if (nutrition.length > 0) {
    lines.push(`Nutrition : ${nutrition.map((n) => `${n.nutrient} ${n.amount}${n.unit}`).join(', ')}`);
  }
  if (yields.length > 0) {
    lines.push(`Rendement : ${yields.map((y) => `${y.inputLevel} ${y.min}-${y.average}-${y.potential} ${y.unit}`).join(', ')}`);
  }
  if (prices.length > 0) {
    const latest = prices[0];
    lines.push(`Prix récent : ${latest.price} ${latest.unit} (${latest.market}, ${latest.date})`);
  }
  const completeness = computeCompleteness({
    climatic: !!s.climatic,
    edaphic: !!s.edaphic,
    phenology: phenology.length > 0,
    nutrition: nutrition.length > 0,
    yields: yields.length > 0,
    varieties: varieties.length > 0,
    zones: zones.length > 0,
    windows: windows.length > 0,
    pests: pests.length > 0,
    prices: prices.length > 0,
  });
  return {
    id: s.id, name, scientificName: s.scientificName, family: s.family,
    cycleType: s.cycleType, status: s.status, version: s.version,
    metadata: s.metadata, climatic: s.climatic, edaphic: s.edaphic,
    varieties, zones, phenology, croppingWindows: windows, pests, nutrition, yields, prices, completeness, serializedText: lines.join('\n'),
    hasUnpublishedChanges: s.hasUnpublishedChanges,
    hasPublishedVersion: s.hasPublishedVersion,
    publishedVersion: s.publishedVersion,
  };
}
