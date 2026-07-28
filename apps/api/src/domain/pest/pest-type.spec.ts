import { PestType } from './pest-type';

describe('PestType', () => {
  it('contient les catégories animales, adventices et maladies', () => {
    expect(Object.values(PestType).sort()).toEqual(
      [
        'ANNUAL_BROADLEAF', 'ANNUAL_GRASS', 'BACTERIA', 'BIRD', 'DEFICIENCY', 'FUNGUS',
        'INSECT', 'MAMMAL', 'MITE', 'MOLLUSC', 'NEMATODE', 'OOMYCETE', 'OTHER',
        'PERENNIAL_BROADLEAF', 'PERENNIAL_GRASS', 'PHYTOPLASMA', 'SEDGE', 'VIRUS',
      ].sort(),
    );
    ['FUNGUS', 'BACTERIA', 'VIRUS', 'PHYTOPLASMA', 'OOMYCETE', 'DEFICIENCY'].forEach((t) =>
      expect(Object.values(PestType)).toContain(t),
    );
  });
});
