import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { CreateZoneUseCase } from '../zone/create-zone.use-case';
import { AddCroppingWindowUseCase } from './add-cropping-window.use-case';
import { ListCroppingWindowsUseCase } from './list-cropping-windows.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { ZoneNotFoundError } from '../zone/set-crop-zone-suitability.use-case';
import { InMemoryCropRepository } from '../crop/in-memory-crop.repository';
import { InMemoryCropEventStore } from '../crop/in-memory-crop-event-store';
import { InMemoryZoneRepository } from '../zone/in-memory-zone.repository';
import { InMemoryCroppingWindowRepository } from './in-memory-cropping-window.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { OperationType } from '../../domain/window/operation-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };
let seq = 0;
const ids = { next: () => `w-${++seq}` };

async function setup() {
  const events = new InMemoryCropEventStore();
  const crops = new InMemoryCropRepository();
  const zones = new InMemoryZoneRepository();
  const windows = new InMemoryCroppingWindowRepository();
  const audit = { record: jest.fn() };
  await new CreateCropUseCase(events, crops, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
  await new CreateZoneUseCase(zones, audit, clock, { next: () => 'z1' }).execute({ name: { fr: 'Sahel' }, country: 'BJ', actor: 'a' });
  return { crops, zones, windows, audit };
}

describe('AddCroppingWindowUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('adds a window (crop+zone exist) with operations and lists it', async () => {
    const { crops, zones, windows, audit } = await setup();
    const uc = new AddCroppingWindowUseCase(crops, zones, windows, audit, clock, ids);
    const out = await uc.execute({
      cropId: 'c1', zoneId: 'z1', season: 'Saison sèche', irrigationRequired: true,
      operations: [{ type: OperationType.PLANTING, label: { fr: 'Semis' }, timingDays: 0, inputs: [] }],
      actor: 'a',
    });
    expect(out.season).toBe('Saison sèche');
    expect(out.operations).toHaveLength(1);
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListCroppingWindowsUseCase(windows).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
  });

  it('throws CropNotFoundError / ZoneNotFoundError', async () => {
    const { crops, zones, windows, audit } = await setup();
    const uc = new AddCroppingWindowUseCase(crops, zones, windows, audit, clock, ids);
    await expect(uc.execute({ cropId: 'nope', zoneId: 'z1', season: 'S', actor: 'a' })).rejects.toThrow(CropNotFoundError);
    await expect(uc.execute({ cropId: 'c1', zoneId: 'nope', season: 'S', actor: 'a' })).rejects.toThrow(ZoneNotFoundError);
  });
});
