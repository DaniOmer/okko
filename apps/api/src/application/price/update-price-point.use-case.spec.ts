import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { AddPricePointUseCase, InvalidPricePeriodError } from './add-price-point.use-case';
import { UpdatePricePointUseCase, PricePointNotFoundError } from './update-price-point.use-case';
import { InMemoryCropRepository } from '../crop/in-memory-crop.repository';
import { InMemoryCropEventStore } from '../crop/in-memory-crop-event-store';
import { InMemoryPricePointRepository } from './in-memory-price-point.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-11T00:00:00.000Z' };
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

describe('UpdatePricePointUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('met à jour un relevé de prix par id (même count, nouvelles valeurs + période)', async () => {
    const { events, prices, audit } = await setup();
    const add = new AddPricePointUseCase(events, prices, audit, clock, ids);
    await add.execute({
      cropId: 'c1', id: 'p1', form: 'GRAIN', market: 'Dantokpa', periodStart: '2026-06-01', periodEnd: '2026-06-07',
      price: 350, unit: 'FCFA/kg', currency: 'XOF', actor: 'a',
    });

    const update = new UpdatePricePointUseCase(events, prices, audit, clock);
    const out = await update.execute({
      cropId: 'c1', priceId: 'p1', form: 'GRAIN', market: 'Parakou',
      periodStart: '2026-07-01', periodEnd: '2026-07-15',
      price: 400, unit: 'FCFA/kg', currency: 'XOF', actor: 'a',
    });

    expect(out.id).toBe('p1');
    expect(out.market).toBe('Parakou');
    expect(out.periodStart).toBe('2026-07-01');
    expect(out.periodEnd).toBe('2026-07-15');
    expect(out.price).toBe(400);

    const list = await prices.listByCrop('c1');
    expect(list).toHaveLength(1);
    expect(list[0].market).toBe('Parakou');
  });

  it("lève PricePointNotFoundError si l'id n'existe pas", async () => {
    const { events, prices, audit } = await setup();
    const update = new UpdatePricePointUseCase(events, prices, audit, clock);
    await expect(
      update.execute({
        cropId: 'c1', priceId: 'absent', form: 'GRAIN', market: 'M',
        periodStart: '2026-06-01', price: 1, unit: 'u', currency: 'XOF', actor: 'a',
      }),
    ).rejects.toThrow(PricePointNotFoundError);
  });

  it('fin < début → InvalidPricePeriodError', async () => {
    const { events, prices, audit } = await setup();
    const add = new AddPricePointUseCase(events, prices, audit, clock, ids);
    await add.execute({
      cropId: 'c1', id: 'p1', form: 'GRAIN', market: 'Dantokpa', periodStart: '2026-06-01',
      price: 350, unit: 'FCFA/kg', currency: 'XOF', actor: 'a',
    });

    const update = new UpdatePricePointUseCase(events, prices, audit, clock);
    await expect(
      update.execute({
        cropId: 'c1', priceId: 'p1', form: 'GRAIN', market: 'M',
        periodStart: '2026-06-07', periodEnd: '2026-06-01',
        price: 1, unit: 'u', currency: 'XOF', actor: 'a',
      }),
    ).rejects.toThrow(InvalidPricePeriodError);
  });
});
