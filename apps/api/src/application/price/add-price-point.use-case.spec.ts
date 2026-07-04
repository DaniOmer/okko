import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { AddPricePointUseCase } from './add-price-point.use-case';
import { ListCropPricesUseCase } from './list-crop-prices.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { InMemoryCropRepository } from '../crop/in-memory-crop.repository';
import { InMemoryPricePointRepository } from './in-memory-price-point.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `pp-${++seq}` };

async function setup() {
  const crops = new InMemoryCropRepository();
  const prices = new InMemoryPricePointRepository();
  const audit = { record: jest.fn() };
  await new CreateCropUseCase(crops, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
  return { crops, prices, audit };
}

describe('AddPricePointUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('adds a price point (crop exists) and lists it', async () => {
    const { crops, prices, audit } = await setup();
    const out = await new AddPricePointUseCase(crops, prices, audit, clock, ids).execute({
      cropId: 'c1', market: 'Dantokpa', date: '2026-06-01', price: 350, unit: 'FCFA/kg', currency: 'XOF', actor: 'a',
    });
    expect(out.market).toBe('Dantokpa');
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListCropPricesUseCase(prices).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
  });

  it('throws CropNotFoundError when the crop does not exist', async () => {
    const { prices, audit } = await setup();
    const crops = new InMemoryCropRepository();
    const uc = new AddPricePointUseCase(crops, prices, audit, clock, ids);
    await expect(uc.execute({ cropId: 'nope', market: 'M', date: '2026-06-01', price: 1, unit: 'u', currency: 'XOF', actor: 'a' }))
      .rejects.toThrow(CropNotFoundError);
  });
});
