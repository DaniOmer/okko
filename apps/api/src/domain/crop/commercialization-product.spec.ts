import { CommercializationProduct } from './commercialization-product';

describe('CommercializationProduct', () => {
  it('round-trip conserve form/saleUnits/outlets', () => {
    const p = CommercializationProduct.create({ form: 'GRAIN', saleUnits: ['KG', 'BAG'], outlets: ['Marché local'] });
    const j = p.toJSON();
    expect(j).toEqual({ form: 'GRAIN', saleUnits: ['KG', 'BAG'], outlets: ['Marché local'] });
    expect(CommercializationProduct.fromJSON(j).toJSON()).toEqual(j);
  });
  it('listes absentes → []', () => {
    const j = CommercializationProduct.create({ form: 'OIL' }).toJSON();
    expect(j.saleUnits).toEqual([]);
    expect(j.outlets).toEqual([]);
  });
});
