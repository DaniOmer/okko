import { Pest } from './pest';
import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

const base = () => Pest.create({
  id: 'p1', name: TranslatableText.create({ fr: 'Chenille' }), type: PestType.INSECT, scientificName: 'Spodoptera',
}).setManagement({ predators: ['Coccinelle'] });

describe('Pest.setSources', () => {
  it('remplace en bloc et préserve identité + gestion', () => {
    const p = base().setSources([{ title: 'FAO', url: 'https://fao.org' }, { title: 'Note interne' }]);
    const s = p.toSnapshot();
    expect(s.scientificName).toBe('Spodoptera');           // identité préservée
    expect(s.predators).toEqual(['Coccinelle']);           // gestion préservée
    expect(s.sources).toEqual([{ title: 'FAO', url: 'https://fao.org' }, { title: 'Note interne' }]);
  });

  it('efface les sources quand la liste est vide', () => {
    const p = base().setSources([{ title: 'X' }]).setSources([]);
    expect(p.toSnapshot().sources).toBeUndefined();
  });
});
