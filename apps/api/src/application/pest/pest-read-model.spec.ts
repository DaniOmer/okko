import { toPestDocument } from './pest-read-model';
import { PestType } from '../../domain/pest/pest-type';

const snap = {
  id: 'p1', name: { fr: 'Mouche des fruits', en: 'Fruit fly' }, type: PestType.INSECT,
  scientificName: 'Bactrocera dorsalis', images: [{ key: 'images/x.jpg' }], metadata: {},
};

describe('toPestDocument', () => {
  it('resolves the name for the locale and serializes', () => {
    const doc = toPestDocument(snap, 'en');
    expect(doc.name).toBe('Fruit fly');
    expect(doc.type).toBe(PestType.INSECT);
    expect(doc.serializedText).toContain('Fruit fly');
    expect(doc.serializedText).toContain('Bactrocera dorsalis');
  });

  it('falls back to fr', () => {
    expect(toPestDocument(snap, 'wo').name).toBe('Mouche des fruits');
  });

  it('exposes biology fields and serializes lifeCycle, cycleDurationDays, generationsPerYear', () => {
    const snapWithBiology = {
      id: 'p2',
      name: { fr: 'Doryphore' },
      type: PestType.INSECT,
      images: [],
      metadata: {},
      lifeCycle: { fr: 'Holométabole' },
      cycleDurationDays: { min: 20, max: 40, unit: 'j' },
      generationsPerYear: { min: 3, max: 6 },
    };
    const doc = toPestDocument(snapWithBiology);
    expect(doc.lifeCycle).toEqual({ fr: 'Holométabole' });
    expect(doc.cycleDurationDays).toEqual({ min: 20, max: 40, unit: 'j' });
    expect(doc.generationsPerYear).toEqual({ min: 3, max: 6 });
    expect(doc.serializedText).toContain('Cycle de vie : Holométabole');
    expect(doc.serializedText).toContain('Durée du cycle : 20–40 j');
    expect(doc.serializedText).toContain('Générations/an : 3–6');
  });
});
