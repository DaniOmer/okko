import { CropDocument } from './crop-read-model';
import { diffCropDocuments, deepEqual } from './crop-diff';

const base: CropDocument = {
  id: 'c1', name: 'Maïs', scientificName: 'Zea mays', family: 'Poaceae', cycleType: 'SEASONAL_ANNUAL',
  status: 'PUBLISHED', version: 1, metadata: {},
  climatic: undefined, edaphic: undefined,
  varieties: [], zones: [], phenology: [], croppingWindows: [], pests: [], nutrition: [], yields: [], commercialization: [], images: [], prices: [],
  completeness: { categories: {}, filled: 0, total: 0, percent: 0 },
  serializedText: '', hasUnpublishedChanges: false, hasPublishedVersion: true, publishedVersion: 0,
};
const doc = (o: Partial<CropDocument>): CropDocument => ({ ...base, ...o });
const variety = (id: string, maturityDays?: number) => ({ id, cropId: 'c1', name: { fr: id }, maturityDays, traits: [] } as any);

describe('diffCropDocuments', () => {
  it('documents identiques -> diff vide', () => {
    const d = diffCropDocuments(1, 2, doc({}), doc({}));
    expect(d).toEqual({ cropId: 'c1', from: 1, to: 2, fields: [], sections: [] });
  });

  it('champ cœur modifié -> fields', () => {
    const d = diffCropDocuments(1, 2, doc({ name: 'Maïs' }), doc({ name: 'Maïs doux' }));
    expect(d.fields).toEqual([{ field: 'name', before: 'Maïs', after: 'Maïs doux' }]);
    expect(d.sections).toEqual([]);
  });

  it('variété ajoutée / supprimée', () => {
    const added = diffCropDocuments(1, 2, doc({ varieties: [] }), doc({ varieties: [variety('Y')] }));
    expect(added.sections).toEqual([{ section: 'varieties', added: [variety('Y')], removed: [], changed: [] }]);
    const removed = diffCropDocuments(1, 2, doc({ varieties: [variety('Y')] }), doc({ varieties: [] }));
    expect(removed.sections).toEqual([{ section: 'varieties', added: [], removed: [variety('Y')], changed: [] }]);
  });

  it('variété modifiée (même id) -> changed', () => {
    const d = diffCropDocuments(1, 2, doc({ varieties: [variety('X', 120)] }), doc({ varieties: [variety('X', 130)] }));
    expect(d.sections).toEqual([{ section: 'varieties', added: [], removed: [],
      changed: [{ key: 'X', before: variety('X', 120), after: variety('X', 130), fields: [{ field: 'maturityDays', before: 120, after: 130 }] }] }]);
  });

  it('zone modifiée par zoneId', () => {
    const z = (rating: string) => ({ zoneId: 'z1', zoneName: { fr: 'Zone 1' }, rating } as any);
    const d = diffCropDocuments(1, 2, doc({ zones: [z('SUITABLE')] }), doc({ zones: [z('MARGINAL')] }));
    expect(d.sections).toEqual([{ section: 'zones', added: [], removed: [],
      changed: [{ key: 'z1', before: z('SUITABLE'), after: z('MARGINAL'), fields: [{ field: 'rating', before: 'SUITABLE', after: 'MARGINAL' }] }] }]);
  });

  it('changed d\'un item porte les sous-champs modifiés (un niveau)', () => {
    const d = diffCropDocuments(1, 2,
      doc({ varieties: [variety('X', 120)] }),
      doc({ varieties: [variety('X', 130)] }));
    expect(d.sections[0].changed[0].fields).toEqual([{ field: 'maturityDays', before: 120, after: 130 }]);
    // before/after entiers conservés
    expect(d.sections[0].changed[0].before).toEqual(variety('X', 120));
    expect(d.sections[0].changed[0].after).toEqual(variety('X', 130));
  });

  it('un champ imbriqué modifié est reporté entier (pas de descente)', () => {
    const vBefore = { id: 'X', cropId: 'c1', name: { fr: 'Obatanpa' }, traits: [] } as any;
    const vAfter = { id: 'X', cropId: 'c1', name: { fr: 'Obatanpa 2' }, traits: [] } as any;
    const d = diffCropDocuments(1, 2, doc({ varieties: [vBefore] }), doc({ varieties: [vAfter] }));
    expect(d.sections[0].changed[0].fields).toEqual([{ field: 'name', before: { fr: 'Obatanpa' }, after: { fr: 'Obatanpa 2' } }]);
  });

  it('section sans clé (phenology) comparée comme valeur entière -> fields', () => {
    const p = (order: number) => ({ name: { fr: 'St' }, startDay: 0, endDay: 10, order } as any);
    const d = diffCropDocuments(1, 2, doc({ phenology: [p(1)] }), doc({ phenology: [p(1), p(2)] }));
    expect(d.fields).toEqual([{ field: 'phenology', before: [p(1)], after: [p(1), p(2)] }]);
  });

  it('commercialisation (section-valeur) modifiée -> fields', () => {
    const p = (form: string) => ({ form, saleUnits: ['KG'], outlets: ['Marché'] } as any);
    const d = diffCropDocuments(1, 2, doc({ commercialization: [] }), doc({ commercialization: [p('GRAIN')] }));
    expect(d.fields).toEqual([{ field: 'commercialization', before: [], after: [p('GRAIN')] }]);
    expect(d.sections).toEqual([]);
  });

  it('metadata insensible à l\'ordre des clés', () => {
    const d = diffCropDocuments(1, 2, doc({ metadata: { a: 1, b: 2 } }), doc({ metadata: { b: 2, a: 1 } }));
    expect(d.fields).toEqual([]);
  });

  it('ignore les champs méta/dérivés exclus (statut, version, complétude, drapeaux, serializedText)', () => {
    const d = diffCropDocuments(1, 2,
      doc({ status: 'PUBLISHED', version: 1, hasUnpublishedChanges: false, hasPublishedVersion: true, serializedText: 'a', completeness: { categories: {}, filled: 0, total: 0, percent: 0 } }),
      doc({ status: 'ARCHIVED', version: 9, hasUnpublishedChanges: true, hasPublishedVersion: true, serializedText: 'b', completeness: { categories: { climatic: true }, filled: 1, total: 10, percent: 10 } }),
    );
    expect(d.fields).toEqual([]);
    expect(d.sections).toEqual([]);
  });

  it('deepEqual gère objets imbriqués et tableaux', () => {
    expect(deepEqual({ x: [1, { y: 2 }] }, { x: [1, { y: 2 }] })).toBe(true);
    expect(deepEqual({ x: 1 }, { x: 2 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('prix — changement de forme (même id) -> changed', () => {
    const p = (form: string) => ({ id: 'pp1', cropId: 'c1', form, market: 'M', periodStart: '2026-06-01', periodEnd: '2026-06-01', price: 300, unit: 'KG', currency: 'XOF' } as any);
    const d = diffCropDocuments(1, 2, doc({ prices: [p('GRAIN')] }), doc({ prices: [p('OIL')] }));
    expect(d.sections).toEqual([{ section: 'prices', added: [], removed: [],
      changed: [{ key: 'pp1', before: p('GRAIN'), after: p('OIL'), fields: [{ field: 'form', before: 'GRAIN', after: 'OIL' }] }] }]);
  });
});
