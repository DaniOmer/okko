import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { CreateZoneUseCase } from './create-zone.use-case';
import { SetCropZoneSuitabilityUseCase, ZoneNotFoundError } from './set-crop-zone-suitability.use-case';
import { ListCropZonesUseCase } from './list-crop-zones.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { InMemoryCropRepository } from '../crop/in-memory-crop.repository';
import { InMemoryZoneRepository } from './in-memory-zone.repository';
import { InMemoryCropZoneSuitabilityRepository } from './in-memory-crop-zone-suitability.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `zone-${++seq}` };

async function setup() {
  const crops = new InMemoryCropRepository();
  const zones = new InMemoryZoneRepository();
  const suit = new InMemoryCropZoneSuitabilityRepository();
  const audit = { record: jest.fn() };
  await new CreateCropUseCase(crops, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
  const zone = await new CreateZoneUseCase(zones, audit, clock, ids).execute({ name: { fr: 'Sahel' }, country: 'BJ', actor: 'a' });
  return { crops, zones, suit, audit, zoneId: zone.id };
}

describe('SetCropZoneSuitabilityUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('sets suitability (crop+zone exist), audits, and lists with zone name', async () => {
    const { crops, zones, suit, audit, zoneId } = await setup();
    const uc = new SetCropZoneSuitabilityUseCase(crops, zones, suit, audit, clock);
    const out = await uc.execute({ cropId: 'c1', zoneId, rating: SuitabilityRating.SUITABLE, justification: 'ok', actor: 'a' });
    expect(out.rating).toBe(SuitabilityRating.SUITABLE);
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListCropZonesUseCase(suit, zones).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
    expect(list[0].zoneName.fr).toBe('Sahel');
    expect(list[0].rating).toBe(SuitabilityRating.SUITABLE);
  });

  it('throws CropNotFoundError when the crop is absent', async () => {
    const { zones, suit, audit, zoneId } = await setup();
    const crops = new InMemoryCropRepository();
    const uc = new SetCropZoneSuitabilityUseCase(crops, zones, suit, audit, clock);
    await expect(uc.execute({ cropId: 'nope', zoneId, rating: SuitabilityRating.SUITABLE, actor: 'a' }))
      .rejects.toThrow(CropNotFoundError);
  });

  it('throws ZoneNotFoundError when the zone is absent', async () => {
    const { crops, zones, suit, audit } = await setup();
    const uc = new SetCropZoneSuitabilityUseCase(crops, zones, suit, audit, clock);
    await expect(uc.execute({ cropId: 'c1', zoneId: 'nope', rating: SuitabilityRating.SUITABLE, actor: 'a' }))
      .rejects.toThrow(ZoneNotFoundError);
  });
});
