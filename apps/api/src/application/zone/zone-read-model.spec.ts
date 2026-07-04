import { toZoneDocument } from './zone-read-model';

const snap = {
  id: 'z1', name: { fr: 'Sahel', en: 'Sahel zone' }, country: 'BJ', koppen: 'BSh',
  annualRainfall: { min: 600, optimal: 900, max: 1200, unit: 'mm' }, metadata: {},
};

describe('toZoneDocument', () => {
  it('resolves the name for the locale and serializes', () => {
    const doc = toZoneDocument(snap, 'en');
    expect(doc.name).toBe('Sahel zone');
    expect(doc.country).toBe('BJ');
    expect(doc.serializedText).toContain('Sahel zone');
    expect(doc.serializedText).toContain('900');
  });

  it('falls back to fr', () => {
    expect(toZoneDocument(snap, 'wo').name).toBe('Sahel');
  });
});
