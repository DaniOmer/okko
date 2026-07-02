import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { CropStatus, CropStatusError } from './crop-status';

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
