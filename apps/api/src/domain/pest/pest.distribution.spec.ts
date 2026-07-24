import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

const base = () => Pest.create({
  id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera',
}).setBiology({ generationsPerYear: { min: 2, max: 4 } }).setDamage({ attackedOrgans: ['LEAVES'] });

describe('Pest.setDistribution', () => {
  it('remplace en bloc et préserve identité + biologie + dégâts', () => {
    const p = base().setDistribution({
      geographicAreas: ['Afrique de l\'Ouest', 'Asie'],
      favorableClimate: TranslatableText.create({ fr: 'Tropical humide' }),
      knownPresence: TranslatableText.create({ fr: 'Endémique en zone soudanienne' }),
    });
    const s = p.toSnapshot();
    expect(s.scientificName).toBe('Spodoptera');                 // identité préservée
    expect(s.generationsPerYear).toEqual({ min: 2, max: 4 });    // biologie préservée
    expect(s.attackedOrgans).toEqual(['LEAVES']);                // dégâts préservés
    expect(s.geographicAreas).toEqual(['Afrique de l\'Ouest', 'Asie']);
    expect(s.favorableClimate).toEqual({ fr: 'Tropical humide' });
    expect(s.knownPresence).toEqual({ fr: 'Endémique en zone soudanienne' });
  });

  it('efface les champs répartition quand le payload est vide', () => {
    const withDist = base().setDistribution({ geographicAreas: ['Afrique'], favorableClimate: TranslatableText.create({ fr: 'X' }) });
    const cleared = withDist.setDistribution({});
    const s = cleared.toSnapshot();
    expect(s.geographicAreas).toBeUndefined();
    expect(s.favorableClimate).toBeUndefined();
  });
});
