import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

describe('Pest.update', () => {
  const base = () => Pest.create({
    id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT,
    scientificName: 'Spodoptera', notes: 'note conservée', images: [{ key: 'images/a.jpg' }],
  });

  it('remplace les champs éditables', () => {
    const p = base().update({ name: TranslatableText.create({ fr: 'Chenille légionnaire' }), type: PestType.MITE, scientificName: 'Spodoptera frugiperda' });
    const s = p.toSnapshot();
    expect(s.name.fr).toBe('Chenille légionnaire');
    expect(s.scientificName).toBe('Spodoptera frugiperda');
    expect(s.type).toBe(PestType.MITE);
  });

  it('préserve les champs avancés', () => {
    const p = base().update({ name: TranslatableText.create({ fr: 'X' }), type: PestType.MITE });
    const s = p.toSnapshot();
    expect(s.notes).toBe('note conservée');
    expect(s.images).toEqual([{ key: 'images/a.jpg' }]);
    expect(s.type).toBe(PestType.MITE);
    expect(s.scientificName).toBeUndefined();
  });
});

describe('Pest.update — famille & description', () => {
  it('met à jour family et description', () => {
    const base = Pest.create({ id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT });
    const updated = base.update({
      name: TranslatableText.create({ fr: 'Chenille légionnaire' }),
      type: PestType.INSECT,
      family: 'Noctuidae',
      description: TranslatableText.create({ fr: 'Ravageur polyphage.' }),
    });
    const snap = updated.toSnapshot();
    expect(snap.family).toBe('Noctuidae');
    expect(snap.description).toEqual({ fr: 'Ravageur polyphage.' });
  });
});
