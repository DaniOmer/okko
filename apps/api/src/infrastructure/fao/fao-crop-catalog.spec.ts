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
});
