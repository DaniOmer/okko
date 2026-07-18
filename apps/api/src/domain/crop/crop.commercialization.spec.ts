import { Crop } from './crop';
import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { CommercializationProduct } from './commercialization-product';

function newCrop() {
  return Crop.create({ id: 'c1', commonNames: TranslatableText.create({ fr: 'Maïs' }), scientificName: 'Zea mays', family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL });
}

describe('Crop — commercialization', () => {
  it('setCommercialization → snapshot expose la liste', () => {
    const c = newCrop();
    c.setCommercialization([CommercializationProduct.create({ form: 'GRAIN', saleUnits: ['KG'], outlets: ['Marché'] })]);
    expect(c.toSnapshot().commercialization).toEqual([{ form: 'GRAIN', saleUnits: ['KG'], outlets: ['Marché'] }]);
  });
  it('crop neuf → commercialization = []', () => {
    expect(newCrop().toSnapshot().commercialization).toEqual([]);
  });
});
