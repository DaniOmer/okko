import { AgroEcologicalZone } from './agro-ecological-zone';
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';

describe('AgroEcologicalZone', () => {
  const base = () => AgroEcologicalZone.create({
    id: 'zone-1',
    name: TranslatableText.create({ fr: 'Zone soudano-sahélienne' }),
    country: 'BJ',
    koppen: 'BSh',
    annualRainfall: RangeValue.create({ min: 600, optimal: 900, max: 1200, unit: 'mm' }),
    notes: 'Saison des pluies unimodale',
  });

  it('exposes its attributes', () => {
    const z = base();
    expect(z.id).toBe('zone-1');
    expect(z.name.getOrDefault('fr')).toBe('Zone soudano-sahélienne');
    expect(z.country).toBe('BJ');
    expect(z.koppen).toBe('BSh');
    expect(z.annualRainfall?.optimal).toBe(900);
  });

  it('round-trips through snapshot', () => {
    const restored = AgroEcologicalZone.fromSnapshot(base().toSnapshot());
    expect(restored.name.getOrDefault('fr')).toBe('Zone soudano-sahélienne');
    expect(restored.annualRainfall?.max).toBe(1200);
    expect(restored.notes).toBe('Saison des pluies unimodale');
  });

  it('defaults metadata to an empty object', () => {
    const z = AgroEcologicalZone.create({ id: 'z', name: TranslatableText.create({ fr: 'X' }), country: 'BJ' });
    expect(z.metadata).toEqual({});
    expect(z.altitude).toBeUndefined();
  });
});
