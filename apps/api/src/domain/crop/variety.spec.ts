import { Variety } from './variety';
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';
import { ResistanceLevel } from './resistance-level';
import { SuitabilityRating } from '../zone/suitability-rating';

describe('Variety', () => {
  const base = () => Variety.create({
    id: 'var-1',
    cropId: 'crop-1',
    name: TranslatableText.create({ fr: 'Obatanpa' }),
    maturityDays: 120,
    yieldPotential: RangeValue.create({ min: 2, optimal: 4, max: 6, unit: 't/ha' }),
    traits: ['tolérante à la sécheresse'],
  });

  it('exposes its attributes', () => {
    const v = base();
    expect(v.cropId).toBe('crop-1');
    expect(v.name.getOrDefault('fr')).toBe('Obatanpa');
    expect(v.maturityDays).toBe(120);
    expect(v.yieldPotential?.optimal).toBe(4);
    expect(v.traits).toEqual(['tolérante à la sécheresse']);
  });

  it('round-trips through snapshot', () => {
    const restored = Variety.fromSnapshot(base().toSnapshot());
    expect(restored.name.getOrDefault('fr')).toBe('Obatanpa');
    expect(restored.yieldPotential?.max).toBe(6);
    expect(restored.traits).toEqual(['tolérante à la sécheresse']);
  });

  it('defaults traits to an empty array', () => {
    const v = Variety.create({ id: 'v', cropId: 'c', name: TranslatableText.create({ fr: 'X' }) });
    expect(v.traits).toEqual([]);
  });
});

describe('Variety — diseaseResistances + zoneAdaptations', () => {
  it('round-trip toSnapshot/fromSnapshot conserve les listes', () => {
    const v = Variety.create({
      id: 'v1', cropId: 'c1', name: TranslatableText.create({ fr: 'Maïs jaune' }),
      diseaseResistances: [{ pestId: 'p1', level: ResistanceLevel.HIGH }],
      zoneAdaptations: [{ zoneId: 'z1', rating: SuitabilityRating.SUITABLE }],
    });
    const s = v.toSnapshot();
    expect(s.diseaseResistances).toEqual([{ pestId: 'p1', level: 'HIGH' }]);
    expect(s.zoneAdaptations).toEqual([{ zoneId: 'z1', rating: 'SUITABLE' }]);
    const back = Variety.fromSnapshot(s).toSnapshot();
    expect(back.diseaseResistances).toEqual([{ pestId: 'p1', level: 'HIGH' }]);
    expect(back.zoneAdaptations).toEqual([{ zoneId: 'z1', rating: 'SUITABLE' }]);
  });
  it('listes absentes → [] (défaut)', () => {
    const s = Variety.create({ id: 'v2', cropId: 'c1', name: TranslatableText.create({ fr: 'X' }) }).toSnapshot();
    expect(s.diseaseResistances).toEqual([]);
    expect(s.zoneAdaptations).toEqual([]);
  });
});
