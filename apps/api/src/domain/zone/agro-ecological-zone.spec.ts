import { AgroEcologicalZone } from './agro-ecological-zone';
import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';

describe('AgroEcologicalZone — champs descriptifs', () => {
  const full = () => AgroEcologicalZone.create({
    id: 'z1', name: TranslatableText.create({ fr: 'Zone Nord' }), country: 'BJ',
    code: 'ZN', region: 'Alibori', description: TranslatableText.create({ fr: 'Savane soudanienne' }),
    climateType: 'SAHELIAN', koppen: 'BSh',
    altitude: RangeValue.create({ min: 200, optimal: 300, max: 400, unit: 'm' }),
    annualRainfall: RangeValue.create({ min: 600, optimal: 800, max: 1000, unit: 'mm' }),
    meanTemperature: 28, meanHumidity: 55,
    rainySeasonStart: 'JUN', rainySeasonEnd: 'OCT', drySeasonStart: 'NOV', drySeasonEnd: 'MAY',
    soilTypes: ['Ferrugineux', 'Sableux'], fertility: 'MEDIUM', drainage: 'GOOD',
  });

  it('create expose tous les champs descriptifs dans le snapshot', () => {
    const s = full().toSnapshot();
    expect(s).toMatchObject({
      code: 'ZN', region: 'Alibori', description: { fr: 'Savane soudanienne' },
      climateType: 'SAHELIAN', koppen: 'BSh', meanTemperature: 28, meanHumidity: 55,
      rainySeasonStart: 'JUN', rainySeasonEnd: 'OCT', drySeasonStart: 'NOV', drySeasonEnd: 'MAY',
      soilTypes: ['Ferrugineux', 'Sableux'], fertility: 'MEDIUM', drainage: 'GOOD',
    });
    expect(s.altitude).toEqual({ min: 200, optimal: 300, max: 400, unit: 'm' });
    expect(s.annualRainfall).toEqual({ min: 600, optimal: 800, max: 1000, unit: 'mm' });
  });

  it('update modifie les champs descriptifs et préserve id/metadata/images', () => {
    const updated = full().update({
      name: TranslatableText.create({ fr: 'Zone Nord' }), country: 'BJ',
      climateType: 'TROPICAL_DRY', fertility: 'HIGH', meanTemperature: 30,
    });
    const s = updated.toSnapshot();
    expect(s.id).toBe('z1');
    expect(s.climateType).toBe('TROPICAL_DRY');
    expect(s.fertility).toBe('HIGH');
    expect(s.meanTemperature).toBe(30);
    expect(s.region).toBeUndefined(); // remplacement : champ non fourni → absent
  });

  it('fromSnapshot round-trip complet', () => {
    const s = full().toSnapshot();
    expect(AgroEcologicalZone.fromSnapshot(s).toSnapshot()).toEqual(s);
  });
});

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

  it('stores images in snapshot and round-trips them', () => {
    const z = AgroEcologicalZone.create({
      id: 'zone-1',
      name: TranslatableText.create({ fr: 'Zone soudano-sahélienne' }),
      country: 'BJ',
      images: [{ key: 'images/z.jpg', caption: 'Vue aérienne' }],
    });
    const snap = z.toSnapshot();
    expect(snap.images).toEqual([{ key: 'images/z.jpg', caption: 'Vue aérienne' }]);
    const restored = AgroEcologicalZone.fromSnapshot(snap);
    expect(restored.images[0].key).toBe('images/z.jpg');
    expect(restored.images[0].caption).toBe('Vue aérienne');
  });

  it('update replaces images when provided', () => {
    const z = AgroEcologicalZone.create({
      id: 'zone-1',
      name: TranslatableText.create({ fr: 'A' }),
      country: 'BJ',
      images: [{ key: 'images/old.jpg' }],
    });
    const updated = z.update({
      name: TranslatableText.create({ fr: 'B' }),
      country: 'BJ',
      images: [{ key: 'images/new.jpg', caption: 'Nouveau' }],
    });
    expect(updated.toSnapshot().images).toEqual([{ key: 'images/new.jpg', caption: 'Nouveau' }]);
  });

  it('update keeps existing images when images not provided', () => {
    const z = AgroEcologicalZone.create({
      id: 'zone-1',
      name: TranslatableText.create({ fr: 'A' }),
      country: 'BJ',
      images: [{ key: 'images/keep.jpg' }],
    });
    const updated = z.update({ name: TranslatableText.create({ fr: 'B' }), country: 'BJ' });
    expect(updated.toSnapshot().images).toEqual([{ key: 'images/keep.jpg' }]);
  });

  it('defaults images to []', () => {
    const z = AgroEcologicalZone.create({ id: 'z', name: TranslatableText.create({ fr: 'X' }), country: 'BJ' });
    expect(z.images).toEqual([]);
    expect(z.toSnapshot().images).toEqual([]);
  });
});
