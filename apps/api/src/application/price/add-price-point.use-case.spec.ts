import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { AddPricePointUseCase, InvalidPricePeriodError } from './add-price-point.use-case';
import { ListCropPricesUseCase } from './list-crop-prices.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { InMemoryCropRepository } from '../crop/in-memory-crop.repository';
import { InMemoryCropEventStore } from '../crop/in-memory-crop-event-store';
import { InMemoryPricePointRepository } from './in-memory-price-point.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `pp-${++seq}` };

async function setup() {
  const events = new InMemoryCropEventStore();
  const crops = new InMemoryCropRepository();
  const prices = new InMemoryPricePointRepository();
  const audit = { record: jest.fn() };
  await new CreateCropUseCase(events, crops, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
  return { events, prices, audit };
}

describe('AddPricePointUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('stocke la plage (periodStart + periodEnd fournis)', async () => {
    const { events, prices, audit } = await setup();
    const out = await new AddPricePointUseCase(events, prices, audit, clock, ids).execute({
      cropId: 'c1', market: 'Dantokpa', periodStart: '2026-06-01', periodEnd: '2026-06-07',
      price: 350, unit: 'FCFA/kg', currency: 'XOF', actor: 'a',
    });
    expect(out.periodStart).toBe('2026-06-01');
    expect(out.periodEnd).toBe('2026-06-07');
    expect(out.market).toBe('Dantokpa');
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListCropPricesUseCase(prices).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
  });

  it('fin omise → periodEnd = periodStart', async () => {
    const { events, prices, audit } = await setup();
    const out = await new AddPricePointUseCase(events, prices, audit, clock, ids).execute({
      cropId: 'c1', market: 'Parakou', periodStart: '2026-06-01',
      price: 200, unit: 'FCFA/kg', currency: 'XOF', actor: 'a',
    });
    expect(out.periodStart).toBe('2026-06-01');
    expect(out.periodEnd).toBe('2026-06-01');
  });

  it('fin < début → InvalidPricePeriodError', async () => {
    const { events, prices, audit } = await setup();
    const uc = new AddPricePointUseCase(events, prices, audit, clock, ids);
    await expect(uc.execute({
      cropId: 'c1', market: 'M', periodStart: '2026-06-07', periodEnd: '2026-06-01',
      price: 1, unit: 'u', currency: 'XOF', actor: 'a',
    })).rejects.toThrow(InvalidPricePeriodError);
  });

  it('throws CropNotFoundError when the crop does not exist', async () => {
    const { prices, audit } = await setup();
    const events = new InMemoryCropEventStore();
    const uc = new AddPricePointUseCase(events, prices, audit, clock, ids);
    await expect(uc.execute({ cropId: 'nope', market: 'M', periodStart: '2026-06-01', price: 1, unit: 'u', currency: 'XOF', actor: 'a' }))
      .rejects.toThrow(CropNotFoundError);
  });
});
