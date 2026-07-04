import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { CropStatus, CropStatusError } from './crop-status';
import { ClimaticRequirements } from '../shared/climatic-requirements';
import { EdaphicRequirements } from '../shared/edaphic-requirements';
import { RangeValue } from '../shared/range-value';
import { PhenologicalStage } from './phenological-stage';
import { NutrientRequirement, NutrientBasis } from './nutrient-requirement';
import { YieldReference, InputLevel } from './yield-reference';

const base = () => Crop.create({
  id: 'crop-1',
  commonNames: TranslatableText.create({ fr: 'Carotte', en: 'Carrot' }),
  scientificName: 'Daucus carota',
  family: 'Apiaceae',
  cycleType: CycleType.SEASONAL_ANNUAL,
});

describe('Crop', () => {
  it("nait en DRAFT version 1", () => {
    const c = base();
    expect(c.status).toBe(CropStatus.DRAFT);
    expect(c.version).toBe(1);
    expect(c.commonNames.getOrDefault('fr')).toBe('Carotte');
  });

  it("se publie depuis DRAFT", () => {
    const c = base();
    c.publish();
    expect(c.status).toBe(CropStatus.PUBLISHED);
  });

  it("refuse d'archiver un DRAFT", () => {
    const c = base();
    expect(() => c.archive()).toThrow(CropStatusError);
  });

  it("incremente la version au renommage", () => {
    const c = base();
    c.rename(TranslatableText.create({ fr: 'Carotte potagère' }));
    expect(c.version).toBe(2);
    expect(c.commonNames.getOrDefault('fr')).toBe('Carotte potagère');
  });

  it("stocke des specificites dans metadata sans schema", () => {
    const c = base();
    c.setMetadata('rusticite', 'élevée');
    expect(c.metadata.rusticite).toBe('élevée');
    expect(c.version).toBe(2);
  });

  it("fait un aller-retour snapshot sans perte", () => {
    const c = base();
    c.publish();
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.status).toBe(CropStatus.PUBLISHED);
    expect(restored.scientificName).toBe('Daucus carota');
  });
});

describe('Crop requirements', () => {
  const base = () => Crop.create({
    id: 'crop-req',
    commonNames: TranslatableText.create({ fr: 'Maïs' }),
    scientificName: 'Zea mays',
    family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL,
  });

  it('sets climatic requirements, bumps version, and survives snapshot round-trip', () => {
    const c = base();
    c.setClimaticRequirements(ClimaticRequirements.create({
      temperature: RangeValue.create({ min: 18, optimal: 25, max: 32, unit: '°C' }),
    }));
    expect(c.version).toBe(2);
    expect(c.climatic?.temperature?.optimal).toBe(25);
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.climatic?.temperature?.optimal).toBe(25);
  });

  it('sets edaphic requirements and round-trips', () => {
    const c = base();
    c.setEdaphicRequirements(EdaphicRequirements.create({
      ph: RangeValue.create({ min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' }),
      texture: 'argilo-limoneux',
    }));
    expect(c.version).toBe(2);
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.edaphic?.ph?.optimal).toBe(6.5);
    expect(restored.edaphic?.texture).toBe('argilo-limoneux');
  });
});

describe('Crop phenology', () => {
  const base = () => Crop.create({
    id: 'crop-phen',
    commonNames: TranslatableText.create({ fr: 'Maïs' }),
    scientificName: 'Zea mays',
    family: 'Poaceae',
    cycleType: CycleType.SEASONAL_ANNUAL,
  });

  it('sets phenology, bumps version, and round-trips', () => {
    const c = base();
    c.setPhenology([
      PhenologicalStage.create({ name: TranslatableText.create({ fr: 'Levée' }), startDay: 5, endDay: 12, order: 1 }),
      PhenologicalStage.create({ name: TranslatableText.create({ fr: 'Floraison' }), startDay: 55, endDay: 65, order: 2 }),
    ]);
    expect(c.version).toBe(2);
    expect(c.phenology).toHaveLength(2);
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.phenology).toHaveLength(2);
    expect(restored.phenology[1].name.getOrDefault('fr')).toBe('Floraison');
  });

  it('defaults phenology to an empty array', () => {
    expect(base().phenology).toEqual([]);
  });
});

describe('Crop nutrition and yields', () => {
  const base = () => Crop.create({
    id: 'crop-nut', commonNames: TranslatableText.create({ fr: 'Maïs' }),
    scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL,
  });

  it('sets nutrition, bumps version, and round-trips', () => {
    const c = base();
    c.setNutrition([NutrientRequirement.create({ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE })]);
    expect(c.version).toBe(2);
    expect(c.nutrition).toHaveLength(1);
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.nutrition[0].nutrient).toBe('N');
  });

  it('sets yields and round-trips', () => {
    const c = base();
    c.setYields([YieldReference.create({ inputLevel: InputLevel.MEDIUM, min: 2, average: 4, potential: 6, unit: 't/ha' })]);
    expect(c.version).toBe(2);
    const restored = Crop.fromSnapshot(c.toSnapshot());
    expect(restored.yields[0].average).toBe(4);
  });

  it('defaults nutrition and yields to empty arrays', () => {
    const c = base();
    expect(c.nutrition).toEqual([]);
    expect(c.yields).toEqual([]);
  });
});
