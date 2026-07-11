import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { CreateZoneUseCase } from '../zone/create-zone.use-case';
import { AddCroppingWindowUseCase } from './add-cropping-window.use-case';
import { UpdateCroppingWindowUseCase, CroppingWindowNotFoundError } from './update-cropping-window.use-case';
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
  // Ajouter une fenêtre initiale avec id 'w1'
  await new AddCroppingWindowUseCase(events, zones, windows, audit, clock, { next: () => 'w1' }).execute({
    cropId: 'c1', zoneId: 'z1', season: 'Saison des pluies', actor: 'a',
    operations: [{ type: OperationType.PLANTING, label: { fr: 'Semis' }, timingDays: 0, inputs: [] }],
  });
  return { events, zones, windows, audit };
}

describe('UpdateCroppingWindowUseCase', () => {
  beforeEach(() => { seq = 0; });

  it('met à jour une fenêtre par id', async () => {
    const { events, zones, windows, audit } = await setup();
    const uc = new UpdateCroppingWindowUseCase(events, zones, windows, audit, clock);
    await uc.execute({
      cropId: 'c1', windowId: 'w1', zoneId: 'z1', season: 'Saison sèche',
      sowingStart: '2026-06-15',
      operations: [{ type: OperationType.PLANTING, label: { fr: 'Semis' }, timingDays: 0, inputs: [] }],
      actor: 'a',
    });
    const list = await new ListCroppingWindowsUseCase(windows).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('w1');
    expect(list[0].season).toBe('Saison sèche');
  });

  it('lève CroppingWindowNotFoundError si l\'id est absent', async () => {
    const { events, zones, windows, audit } = await setup();
    const uc = new UpdateCroppingWindowUseCase(events, zones, windows, audit, clock);
    await expect(uc.execute({ cropId: 'c1', windowId: 'absent', zoneId: 'z1', season: 'S', actor: 'a' }))
      .rejects.toThrow(CroppingWindowNotFoundError);
  });

  it('lève ZoneNotFoundError si la zone est absente', async () => {
    const { events, zones, windows, audit } = await setup();
    const uc = new UpdateCroppingWindowUseCase(events, zones, windows, audit, clock);
    await expect(uc.execute({ cropId: 'c1', windowId: 'w1', zoneId: 'nope', season: 'S', actor: 'a' }))
      .rejects.toThrow(ZoneNotFoundError);
  });

  it('lève CropNotFoundError si le crop est absent', async () => {
    const { events, zones, windows, audit } = await setup();
    const uc = new UpdateCroppingWindowUseCase(events, zones, windows, audit, clock);
    await expect(uc.execute({ cropId: 'nope', windowId: 'w1', zoneId: 'z1', season: 'S', actor: 'a' }))
      .rejects.toThrow(CropNotFoundError);
  });
});
