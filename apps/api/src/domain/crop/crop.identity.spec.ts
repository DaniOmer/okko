import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';

function newCrop() {
  return Crop.create({
    id: 'c1', commonNames: TranslatableText.create({ fr: 'Maïs' }),
    scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL,
    usageCategory: 'CEREAL', description: { fr: 'Céréale de base' },
  });
}

describe('Crop identity — usageCategory + description', () => {
  it('create expose usageCategory + description dans le snapshot', () => {
    const s = newCrop().toSnapshot();
    expect(s.usageCategory).toBe('CEREAL');
    expect(s.description).toEqual({ fr: 'Céréale de base' });
  });
  it('editIdentity met à jour usageCategory + description', () => {
    const c = newCrop();
    c.editIdentity({ scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, usageCategory: 'FODDER', description: { fr: 'Fourrage' } });
    const s = c.toSnapshot();
    expect(s.usageCategory).toBe('FODDER');
    expect(s.description).toEqual({ fr: 'Fourrage' });
  });
  it('create sans usageCategory/description → undefined (optionnel)', () => {
    const s = Crop.create({ id: 'c2', commonNames: TranslatableText.create({ fr: 'X' }), scientificName: 'X', family: 'Y', cycleType: CycleType.SEASONAL_ANNUAL }).toSnapshot();
    expect(s.usageCategory).toBeUndefined();
    expect(s.description).toBeUndefined();
  });
});
