import { CreateZoneUseCase } from './create-zone.use-case';
import { ListZonesUseCase } from './list-zones.use-case';
import { InMemoryZoneRepository } from './in-memory-zone.repository';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `zone-${++seq}` };

describe('CreateZoneUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('creates a zone, audits, and lists it', async () => {
    const repo = new InMemoryZoneRepository();
    const audit = { record: jest.fn() };
    const out = await new CreateZoneUseCase(repo, audit, clock, ids).execute({
      name: { fr: 'Sahel' }, country: 'BJ', koppen: 'BSh',
      annualRainfall: { min: 600, optimal: 900, max: 1200, unit: 'mm' }, actor: 'a',
    });
    expect(out.id).toBe('zone-1');
    expect(out.name.fr).toBe('Sahel');
    expect(out.annualRainfall?.optimal).toBe(900);
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListZonesUseCase(repo).execute();
    expect(list).toHaveLength(1);
  });
});
