import { toPestDocument } from './pest-read-model';
import { PestType } from '../../domain/pest/pest-type';

const snap = {
  id: 'p1', name: { fr: 'Mouche des fruits', en: 'Fruit fly' }, type: PestType.INSECT,
  scientificName: 'Bactrocera dorsalis', photos: ['x.jpg'], metadata: {},
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
});
