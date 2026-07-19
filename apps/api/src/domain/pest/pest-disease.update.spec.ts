import { PestDisease } from './pest-disease';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

describe('PestDisease.update', () => {
  const base = () => PestDisease.create({
    id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT,
    scientificName: 'Spodoptera', notes: 'note conservée', images: [{ key: 'images/a.jpg' }],
  });

  it('remplace les champs éditables', () => {
    const p = base().update({ name: TranslatableText.create({ fr: 'Chenille légionnaire' }), type: PestType.INSECT, scientificName: 'Spodoptera frugiperda' });
    const s = p.toSnapshot();
    expect(s.name.fr).toBe('Chenille légionnaire');
    expect(s.scientificName).toBe('Spodoptera frugiperda');
  });

  it('préserve les champs avancés', () => {
    const p = base().update({ name: TranslatableText.create({ fr: 'X' }), type: PestType.FUNGUS });
    const s = p.toSnapshot();
    expect(s.notes).toBe('note conservée');
    expect(s.images).toEqual([{ key: 'images/a.jpg' }]);
    expect(s.type).toBe(PestType.FUNGUS);
    expect(s.scientificName).toBeUndefined();
  });
});
