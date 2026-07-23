import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

const base = () => Pest.create({
  id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera',
}).setBiology({ generationsPerYear: { min: 2, max: 4 } });

describe('Pest.setDamage', () => {
  it('remplace en bloc et préserve identité + biologie', () => {
    const p = base().setDamage({
      symptoms: TranslatableText.create({ fr: 'Feuilles trouées' }),
      attackedOrgans: ['LEAVES', 'FRUITS'],
      damageTypes: ['BITES', 'PERFORATIONS'],
      harmfulnessLevel: 'MAJOR',
    });
    const s = p.toSnapshot();
    expect(s.scientificName).toBe('Spodoptera');                 // identité préservée
    expect(s.generationsPerYear).toEqual({ min: 2, max: 4 });    // biologie préservée
    expect(s.symptoms).toEqual({ fr: 'Feuilles trouées' });
    expect(s.attackedOrgans).toEqual(['LEAVES', 'FRUITS']);
    expect(s.damageTypes).toEqual(['BITES', 'PERFORATIONS']);
    expect(s.harmfulnessLevel).toBe('MAJOR');
  });

  it('efface les champs dégâts + symptômes quand le payload est vide', () => {
    const withDamage = base().setDamage({ symptoms: TranslatableText.create({ fr: 'X' }), attackedOrgans: ['ROOTS'], harmfulnessLevel: 'MINOR' });
    const cleared = withDamage.setDamage({});
    const s = cleared.toSnapshot();
    expect(s.symptoms).toBeUndefined();
    expect(s.attackedOrgans).toBeUndefined();
    expect(s.harmfulnessLevel).toBeUndefined();
  });
});
