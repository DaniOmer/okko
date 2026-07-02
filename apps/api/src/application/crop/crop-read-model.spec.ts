import { toCropDocument } from './crop-read-model';
import { CropStatus } from '../../domain/crop/crop-status';
import { CycleType } from '../../domain/crop/cycle-type';

const snap = {
  id: 'c1', commonNames: { fr: 'Carotte', en: 'Carrot' },
  scientificName: 'Daucus carota', family: 'Apiaceae',
  cycleType: CycleType.SEASONAL_ANNUAL, status: CropStatus.PUBLISHED,
  version: 3, metadata: { rusticite: 'élevée' },
};

describe('toCropDocument', () => {
  it('résout le nom dans la locale demandée', () => {
    const doc = toCropDocument(snap, 'en');
    expect(doc.name).toBe('Carrot');
  });

  it('retombe sur fr si la locale manque', () => {
    const doc = toCropDocument(snap, 'wo');
    expect(doc.name).toBe('Carotte');
  });

  it('produit un texte markdown sérialisé pour un LLM', () => {
    const doc = toCropDocument(snap, 'fr');
    expect(doc.serializedText).toContain('Carotte');
    expect(doc.serializedText).toContain('Daucus carota');
    expect(doc.serializedText).toContain('SEASONAL_ANNUAL');
  });

  it('mappe correctement tous les champs CropDocument', () => {
    const doc = toCropDocument(snap, 'fr');
    expect(doc.id).toBe('c1');
    expect(doc.family).toBe('Apiaceae');
    expect(doc.cycleType).toBe(CycleType.SEASONAL_ANNUAL);
    expect(doc.status).toBe(CropStatus.PUBLISHED);
    expect(doc.version).toBe(3);
    expect(doc.metadata).toEqual({ rusticite: 'élevée' });
  });
});
