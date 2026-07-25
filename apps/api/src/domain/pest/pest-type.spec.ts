import { PestType } from './pest-type';

describe('PestType', () => {
  it('contient les catégories animales et les catégories adventices, pas les pathogènes', () => {
    expect(Object.values(PestType).sort()).toEqual(
      ['ANNUAL_BROADLEAF', 'ANNUAL_GRASS', 'BIRD', 'INSECT', 'MAMMAL', 'MITE', 'MOLLUSC', 'NEMATODE', 'OTHER', 'PERENNIAL_BROADLEAF', 'PERENNIAL_GRASS', 'SEDGE'].sort(),
    );
    expect(Object.values(PestType)).not.toContain('FUNGUS');
    expect(Object.values(PestType)).not.toContain('VIRUS');
    expect(Object.values(PestType)).not.toContain('BACTERIA');
  });
});
