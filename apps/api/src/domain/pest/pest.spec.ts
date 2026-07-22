import { Pest } from './pest';
import { PestType } from './pest-type';
import { TranslatableText } from '../shared/translatable-text';

describe('Pest', () => {
  const base = () => Pest.create({
    id: 'pest-1',
    name: TranslatableText.create({ fr: 'Mouche des fruits' }),
    type: PestType.INSECT,
    scientificName: 'Bactrocera dorsalis',
    symptoms: TranslatableText.create({ fr: 'Piqûres et pourriture des fruits' }),
    images: [{ key: 'images/mouche.jpg' }],
  });

  it('exposes its attributes', () => {
    const p = base();
    expect(p.name.getOrDefault('fr')).toBe('Mouche des fruits');
    expect(p.type).toBe(PestType.INSECT);
    expect(p.scientificName).toBe('Bactrocera dorsalis');
    expect(p.images[0].key).toBe('images/mouche.jpg');
  });

  it('round-trips through snapshot', () => {
    const restored = Pest.fromSnapshot(base().toSnapshot());
    expect(restored.name.getOrDefault('fr')).toBe('Mouche des fruits');
    expect(restored.symptoms?.getOrDefault('fr')).toBe('Piqûres et pourriture des fruits');
    expect(restored.type).toBe(PestType.INSECT);
    expect(restored.images[0].key).toBe('images/mouche.jpg');
  });

  it('defaults images to [] and metadata to {}', () => {
    const p = Pest.create({ id: 'p', name: TranslatableText.create({ fr: 'X' }), type: PestType.FUNGUS });
    expect(p.images).toEqual([]);
    expect(p.metadata).toEqual({});
    expect(p.symptoms).toBeUndefined();
  });

  it('stores images in snapshot and round-trips them', () => {
    const p = Pest.create({
      id: 'pest-1',
      name: TranslatableText.create({ fr: 'Mouche des fruits' }),
      type: PestType.INSECT,
      images: [{ key: 'images/p.jpg', caption: 'Larve' }],
    });
    const snap = p.toSnapshot();
    expect(snap.images).toEqual([{ key: 'images/p.jpg', caption: 'Larve' }]);
    const restored = Pest.fromSnapshot(snap);
    expect(restored.images[0].key).toBe('images/p.jpg');
    expect(restored.images[0].caption).toBe('Larve');
  });

  it('update replaces images when provided', () => {
    const p = Pest.create({
      id: 'pest-1',
      name: TranslatableText.create({ fr: 'A' }),
      type: PestType.INSECT,
      images: [{ key: 'images/old.jpg' }],
    });
    const updated = p.update({
      name: TranslatableText.create({ fr: 'B' }),
      type: PestType.FUNGUS,
      images: [{ key: 'images/new.jpg', caption: 'Nouveau' }],
    });
    expect(updated.toSnapshot().images).toEqual([{ key: 'images/new.jpg', caption: 'Nouveau' }]);
  });

  it('update keeps existing images when images not provided', () => {
    const p = Pest.create({
      id: 'pest-1',
      name: TranslatableText.create({ fr: 'A' }),
      type: PestType.INSECT,
      images: [{ key: 'images/keep.jpg' }],
    });
    const updated = p.update({ name: TranslatableText.create({ fr: 'B' }), type: PestType.FUNGUS });
    expect(updated.toSnapshot().images).toEqual([{ key: 'images/keep.jpg' }]);
  });
});
