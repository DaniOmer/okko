import { PestDisease } from './pest-disease';
import { PestType } from './pest-type';
import { TranslatableText } from '../shared/translatable-text';

describe('PestDisease', () => {
  const base = () => PestDisease.create({
    id: 'pest-1',
    name: TranslatableText.create({ fr: 'Mouche des fruits' }),
    type: PestType.INSECT,
    scientificName: 'Bactrocera dorsalis',
    symptoms: TranslatableText.create({ fr: 'Piqûres et pourriture des fruits' }),
    photos: ['https://example/mouche.jpg'],
  });

  it('exposes its attributes', () => {
    const p = base();
    expect(p.name.getOrDefault('fr')).toBe('Mouche des fruits');
    expect(p.type).toBe(PestType.INSECT);
    expect(p.scientificName).toBe('Bactrocera dorsalis');
    expect(p.photos).toEqual(['https://example/mouche.jpg']);
  });

  it('round-trips through snapshot', () => {
    const restored = PestDisease.fromSnapshot(base().toSnapshot());
    expect(restored.name.getOrDefault('fr')).toBe('Mouche des fruits');
    expect(restored.symptoms?.getOrDefault('fr')).toBe('Piqûres et pourriture des fruits');
    expect(restored.type).toBe(PestType.INSECT);
  });

  it('defaults photos to [] and metadata to {}', () => {
    const p = PestDisease.create({ id: 'p', name: TranslatableText.create({ fr: 'X' }), type: PestType.FUNGUS });
    expect(p.photos).toEqual([]);
    expect(p.metadata).toEqual({});
    expect(p.symptoms).toBeUndefined();
  });
});
