import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

const base = () => Pest.create({
  id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera',
}).setBiology({ generationsPerYear: { min: 2, max: 4 } }).setDamage({ attackedOrgans: ['LEAVES'] })
  .setDistribution({ geographicAreas: ['Afrique'] });

describe('Pest.setManagement', () => {
  it('remplace en bloc et préserve identité + biologie + dégâts + répartition', () => {
    const p = base().setManagement({
      prevention: TranslatableText.create({ fr: 'Rotation des cultures' }),
      biologicalControl: TranslatableText.create({ fr: 'Lâchers de Trichogramma' }),
      predators: ['Coccinelle'],
      parasitoids: ['Trichogramma'],
      approvedProducts: [{ name: 'Bacillus thuringiensis', country: 'BJ' }, { name: 'Spinosad' }],
      knownResistances: TranslatableText.create({ fr: 'Résistance aux pyréthrinoïdes' }),
    });
    const s = p.toSnapshot();
    expect(s.scientificName).toBe('Spodoptera');                 // identité préservée
    expect(s.generationsPerYear).toEqual({ min: 2, max: 4 });    // biologie préservée
    expect(s.attackedOrgans).toEqual(['LEAVES']);                // dégâts préservés
    expect(s.geographicAreas).toEqual(['Afrique']);              // répartition préservée
    expect(s.prevention).toEqual({ fr: 'Rotation des cultures' });
    expect(s.biologicalControl).toEqual({ fr: 'Lâchers de Trichogramma' });
    expect(s.predators).toEqual(['Coccinelle']);
    expect(s.parasitoids).toEqual(['Trichogramma']);
    expect(s.approvedProducts).toEqual([{ name: 'Bacillus thuringiensis', country: 'BJ' }, { name: 'Spinosad' }]);
    expect(s.knownResistances).toEqual({ fr: 'Résistance aux pyréthrinoïdes' });
  });

  it('efface les champs gestion quand le payload est vide', () => {
    const withMgmt = base().setManagement({ predators: ['X'], prevention: TranslatableText.create({ fr: 'Y' }) });
    const cleared = withMgmt.setManagement({});
    const s = cleared.toSnapshot();
    expect(s.predators).toBeUndefined();
    expect(s.prevention).toBeUndefined();
  });
});
