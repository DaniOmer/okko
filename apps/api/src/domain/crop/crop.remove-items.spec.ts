import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { VarietySnapshot } from './variety';
import { CroppingWindowSnapshot } from '../window/cropping-window';
import { CropZoneSuitabilitySnapshot } from '../zone/crop-zone-suitability';
import { CropPestControlSnapshot } from '../pest/crop-pest-control';
import { PricePointSnapshot } from '../price/price-point';

const newCrop = () => Crop.create({ id: 'c1', commonNames: TranslatableText.create({ fr: 'Maïs' }), scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL });
const variety = (id: string) => ({ id, cropId: 'c1', name: { fr: id }, traits: [] } as VarietySnapshot);
const window = (id: string) => ({ id, cropId: 'c1', zoneId: 'z1', season: 'Saison des pluies', irrigationRequired: false, operations: [] } as CroppingWindowSnapshot);
const price = (id: string) => ({ id, cropId: 'c1', form: 'GRAIN', market: 'M', periodStart: '2026-01', periodEnd: '2026-01', price: 100, unit: 'KG', currency: 'XOF' } as PricePointSnapshot);
const zone = (zoneId: string) => ({ cropId: 'c1', zoneId, rating: 'SUITABLE' } as CropZoneSuitabilitySnapshot);
const pest = (pestId: string) => ({ cropId: 'c1', pestId, susceptibility: 'MEDIUM', sensitiveStages: [], controlMethods: [] } as CropPestControlSnapshot);

describe('Crop — remove items', () => {
  it('removeVariety retire la variété ciblée et préserve les autres', () => {
    const c = newCrop(); c.addVariety(variety('v1')); c.addVariety(variety('v2'));
    c.removeVariety('v1');
    expect(c.varieties.map((v) => v.id)).toEqual(['v2']);
    expect(c.toSnapshot().hasUnpublishedChanges).toBe(true);
  });
  it('removeCroppingWindow retire la fenêtre ciblée', () => {
    const c = newCrop(); c.addCroppingWindow(window('w1')); c.addCroppingWindow(window('w2'));
    c.removeCroppingWindow('w1');
    expect(c.windows.map((w) => w.id)).toEqual(['w2']);
  });
  it('removePricePoint retire le prix ciblé', () => {
    const c = newCrop(); c.addPricePoint(price('pr1')); c.addPricePoint(price('pr2'));
    c.removePricePoint('pr1');
    expect(c.prices.map((p) => p.id)).toEqual(['pr2']);
  });
  it('removeZoneSuitability retire la note de la zone ciblée', () => {
    const c = newCrop(); c.setZoneSuitability(zone('z1')); c.setZoneSuitability(zone('z2'));
    c.removeZoneSuitability('z1');
    expect(c.zones.map((z) => z.zoneId)).toEqual(['z2']);
  });
  it('removePestControl retire le lien du ravageur ciblé', () => {
    const c = newCrop(); c.setPestControl(pest('p1')); c.setPestControl(pest('p2'));
    c.removePestControl('p1');
    expect(c.pests.map((p) => p.pestId)).toEqual(['p2']);
  });
  it('un retrait sur un id absent laisse la collection inchangée', () => {
    const c = newCrop(); c.addVariety(variety('v1'));
    c.removeVariety('nope');
    expect(c.varieties.map((v) => v.id)).toEqual(['v1']);
  });
});
