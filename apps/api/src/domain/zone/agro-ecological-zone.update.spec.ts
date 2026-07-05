import { AgroEcologicalZone } from './agro-ecological-zone';
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';

describe('AgroEcologicalZone.update', () => {
  const base = () => AgroEcologicalZone.create({
    id: 'z1', name: TranslatableText.create({ fr: 'Sahel' }), country: 'BF', koppen: 'BSh',
    annualRainfall: RangeValue.create({ min: 300, optimal: 600, max: 900, unit: 'mm' }),
    notes: 'note conservée',
  });

  it('remplace les champs éditables et renvoie un nouvel agrégat', () => {
    const z = base().update({ name: TranslatableText.create({ fr: 'Sahel Nord' }), country: 'NE', koppen: 'BWh' });
    const s = z.toSnapshot();
    expect(s.name.fr).toBe('Sahel Nord');
    expect(s.country).toBe('NE');
    expect(s.koppen).toBe('BWh');
  });

  it('préserve les champs avancés non éditables', () => {
    const z = base().update({ name: TranslatableText.create({ fr: 'X' }), country: 'BF' });
    const s = z.toSnapshot();
    expect(s.notes).toBe('note conservée');
    expect(s.annualRainfall?.optimal).toBe(600);
    expect(s.koppen).toBeUndefined(); // koppen omis => effacé
  });
});
