import { toCropDocument } from './crop-read-model';
import { CropStatus } from '../../domain/crop/crop-status';
import { CycleType } from '../../domain/crop/cycle-type';
import { VarietySnapshot } from '../../domain/crop/variety';
import { CropZoneView } from '../zone/list-crop-zones.use-case';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';
import { CropPestView } from '../pest/list-crop-pests.use-case';
import { PestType } from '../../domain/pest/pest-type';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';
import { PricePointSnapshot } from '../../domain/price/price-point';
import { NutrientBasis } from '../../domain/crop/nutrient-requirement';
import { InputLevel } from '../../domain/crop/yield-reference';

const snap = {
  id: 'c1', commonNames: { fr: 'Carotte', en: 'Carrot' },
  scientificName: 'Daucus carota', family: 'Apiaceae',
  cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED,
  version: 3, metadata: { rusticite: 'élevée' },
};

describe('toCropDocument', () => {
  it('résout le nom dans la locale demandée', () => {
    const doc = toCropDocument(snap, { locale: 'en' });
    expect(doc.name).toBe('Carrot');
  });

  it('retombe sur fr si la locale manque', () => {
    const doc = toCropDocument(snap, { locale: 'wo' });
    expect(doc.name).toBe('Carotte');
  });

  it('produit un texte markdown sérialisé pour un LLM', () => {
    const doc = toCropDocument(snap, { locale: 'fr' });
    expect(doc.serializedText).toContain('Carotte');
    expect(doc.serializedText).toContain('Daucus carota');
    expect(doc.serializedText).toContain('SEASONAL_ANNUAL');
  });

  it('mappe correctement tous les champs CropDocument', () => {
    const doc = toCropDocument(snap, { locale: 'fr' });
    expect(doc.id).toBe('c1');
    expect(doc.family).toBe('Apiaceae');
    expect(doc.cycleType).toBe(CycleType.SEASONAL_ANNUAL);
    expect(doc.status).toBe(CropStatus.PUBLISHED);
    expect(doc.version).toBe(3);
    expect(doc.metadata).toEqual({ rusticite: 'élevée' });
  });
});

describe('toCropDocument with requirements and varieties', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED, version: 4, metadata: {},
    climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } },
    edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' } },
  };
  const varieties: VarietySnapshot[] = [
    { id: 'v1', cropId: 'c1', name: { fr: 'Obatanpa' }, traits: [] },
  ];

  it('includes requirements and varieties in the document and serialized text', () => {
    const doc = toCropDocument(snap, { varieties });
    expect(doc.climatic?.temperature?.optimal).toBe(25);
    expect(doc.edaphic?.ph?.optimal).toBe(6.5);
    expect(doc.varieties).toHaveLength(1);
    expect(doc.serializedText).toContain('Obatanpa');
    expect(doc.serializedText).toContain('25');
    expect(doc.serializedText).toContain('6.5');
  });

  it('defaults varieties to an empty array', () => {
    const doc = toCropDocument(snap, { locale: 'fr' });
    expect(doc.varieties).toEqual([]);
  });
});

describe('toCropDocument with zones', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED, version: 5, metadata: {},
  };
  const zones: CropZoneView[] = [
    { zoneId: 'z1', zoneName: { fr: 'Sahel' }, rating: SuitabilityRating.SUITABLE },
  ];

  it('includes zones and mentions them in serialized text', () => {
    const doc = toCropDocument(snap, { zones });
    expect(doc.zones).toHaveLength(1);
    expect(doc.serializedText).toContain('Sahel');
  });

  it('defaults zones to an empty array', () => {
    expect(toCropDocument(snap, { locale: 'fr' }).zones).toEqual([]);
  });
});

describe('toCropDocument with phenology and windows', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED, version: 6, metadata: {},
    phenology: [{ name: { fr: 'Levée' }, startDay: 5, endDay: 12, order: 1 }],
  };
  const windows = [
    { id: 'w1', cropId: 'c1', zoneId: 'z1', season: 'Saison sèche', irrigationRequired: true, operations: [] },
  ];

  it('includes phenology and windows in the document and serialized text', () => {
    const doc = toCropDocument(snap, { windows });
    expect(doc.phenology).toHaveLength(1);
    expect(doc.croppingWindows).toHaveLength(1);
    expect(doc.serializedText).toContain('Levée');
    expect(doc.serializedText).toContain('Saison sèche');
  });

  it('defaults phenology and windows to empty arrays', () => {
    const doc = toCropDocument({ ...snap, phenology: undefined }, { locale: 'fr' });
    expect(doc.phenology).toEqual([]);
    expect(doc.croppingWindows).toEqual([]);
  });
});

describe('toCropDocument with pests', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Manguier' }, scientificName: 'Mangifera indica', family: 'Anacardiaceae',
    cycleType: CycleType.PERENNIAL_WOODY_FRUIT, status: CropStatus.PUBLISHED, version: 7, metadata: {},
  };
  const pests: CropPestView[] = [
    { pestId: 'p1', pestName: { fr: 'Mouche des fruits' }, type: PestType.INSECT, susceptibility: SusceptibilityLevel.HIGH, controlMethods: [] },
  ];

  it('includes pests in the document and serialized text', () => {
    const doc = toCropDocument(snap, { pests });
    expect(doc.pests).toHaveLength(1);
    expect(doc.serializedText).toContain('Mouche des fruits');
  });

  it('defaults pests to an empty array', () => {
    expect(toCropDocument(snap).pests).toEqual([]);
  });
});

describe('toCropDocument with nutrition, yields and prices', () => {
  const snap = {
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays', family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED, version: 8, metadata: {},
    nutrition: [{ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE }],
    yields: [{ inputLevel: InputLevel.MEDIUM, min: 2, average: 4, potential: 6, unit: 't/ha' }],
  };
  const prices: PricePointSnapshot[] = [
    { id: 'pp1', cropId: 'c1', market: 'Dantokpa', date: '2026-06-01', price: 350, unit: 'FCFA/kg', currency: 'XOF' },
  ];

  it('includes nutrition, yields and prices in the document and serialized text', () => {
    const doc = toCropDocument(snap, { prices });
    expect(doc.nutrition).toHaveLength(1);
    expect(doc.yields).toHaveLength(1);
    expect(doc.prices).toHaveLength(1);
    expect(doc.serializedText).toContain('N');
    expect(doc.serializedText).toContain('Dantokpa');
  });

  it('defaults nutrition, yields and prices to empty arrays', () => {
    const doc = toCropDocument({ ...snap, nutrition: undefined, yields: undefined });
    expect(doc.nutrition).toEqual([]);
    expect(doc.yields).toEqual([]);
    expect(doc.prices).toEqual([]);
  });
});
