import { PestType } from './pest-type';

describe('PestType (catégories animales)', () => {
  it('contient les catégories animales et pas les pathogènes', () => {
    expect(Object.values(PestType).sort()).toEqual(
      ['BIRD', 'INSECT', 'MAMMAL', 'MITE', 'MOLLUSC', 'NEMATODE', 'OTHER'].sort(),
    );
    expect(Object.values(PestType)).not.toContain('FUNGUS');
    expect(Object.values(PestType)).not.toContain('VIRUS');
    expect(Object.values(PestType)).not.toContain('BACTERIA');
    expect(Object.values(PestType)).not.toContain('WEED');
  });
});
