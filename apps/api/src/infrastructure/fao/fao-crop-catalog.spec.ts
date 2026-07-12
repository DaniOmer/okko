import { FaoCropCatalog } from './fao-crop-catalog';

describe('FaoCropCatalog', () => {
  let catalog: FaoCropCatalog;

  beforeEach(() => {
    catalog = new FaoCropCatalog();
  });

  it('search("maï") renvoie une entrée dont nameFr === "Maïs" (insensible accents/casse)', () => {
    const results = catalog.search('maï');
    expect(results.some((c) => c.nameFr === 'Maïs')).toBe(true);
  });

  it('search("rice") trouve "Riz" via nameEn', () => {
    const results = catalog.search('rice');
    expect(results.some((c) => c.nameFr === 'Riz')).toBe(true);
  });

  it('search("") renvoie la liste complète (≤ 20)', () => {
    const results = catalog.search('');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it('search("SORGHO") est insensible à la casse', () => {
    const results = catalog.search('SORGHO');
    expect(results.some((c) => c.nameEn === 'Sorghum')).toBe(true);
  });

  it('search résultat contient { code, nameFr, nameEn }', () => {
    const [first] = catalog.search('');
    expect(first).toHaveProperty('code');
    expect(first).toHaveProperty('nameFr');
    expect(first).toHaveProperty('nameEn');
  });

  it('le code de "Maïs" est le code FAO numérique 0338', () => {
    const maize = catalog.search('maïs').find((c) => c.nameFr === 'Maïs');
    expect(maize?.code).toBe('0338');
  });

  it('le code de "Riz" est le code FAO numérique 0303', () => {
    const rice = catalog.search('riz').find((c) => c.nameFr === 'Riz');
    expect(rice?.code).toBe('0303');
  });
});
