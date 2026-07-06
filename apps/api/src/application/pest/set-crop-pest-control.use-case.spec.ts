import { CreateCropUseCase } from '../crop/create-crop.use-case';
import { CreatePestUseCase } from './create-pest.use-case';
import { SetCropPestControlUseCase, PestNotFoundError } from './set-crop-pest-control.use-case';
import { ListCropPestsUseCase } from './list-crop-pests.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { InMemoryCropRepository } from '../crop/in-memory-crop.repository';
import { InMemoryCropEventStore } from '../crop/in-memory-crop-event-store';
import { InMemoryPestRepository } from './in-memory-pest.repository';
import { InMemoryCropPestControlRepository } from './in-memory-crop-pest-control.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { PestType } from '../../domain/pest/pest-type';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';
import { ProvenanceSource } from '../../domain/shared/provenance';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };

async function setup() {
  const events = new InMemoryCropEventStore();
  const crops = new InMemoryCropRepository();
  const pests = new InMemoryPestRepository();
  const controls = new InMemoryCropPestControlRepository();
  const audit = { record: jest.fn() };
  await new CreateCropUseCase(events, crops, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Manguier' }, scientificName: 'Mangifera indica',
    family: 'Anacardiaceae', cycleType: CycleType.PERENNIAL_WOODY_FRUIT, actor: 'a',
  });
  const pest = await new CreatePestUseCase(pests, audit, clock, { next: () => 'p1' }).execute({
    name: { fr: 'Mouche des fruits' }, type: PestType.INSECT, actor: 'a',
  });
  return { crops, pests, controls, audit, pestId: pest.id };
}

describe('SetCropPestControlUseCase', () => {
  it('sets control (crop+pest exist), defaults provenance to MANUAL, audits, and lists with pest name', async () => {
    const { crops, pests, controls, audit, pestId } = await setup();
    const uc = new SetCropPestControlUseCase(crops, pests, controls, audit, clock);
    const out = await uc.execute({ cropId: 'c1', pestId, susceptibility: SusceptibilityLevel.HIGH, actor: 'a' });
    expect(out.susceptibility).toBe(SusceptibilityLevel.HIGH);
    expect(out.provenance?.source).toBe(ProvenanceSource.MANUAL);
    expect(audit.record).toHaveBeenCalled();

    const list = await new ListCropPestsUseCase(controls, pests).execute({ cropId: 'c1' });
    expect(list).toHaveLength(1);
    expect(list[0].pestName.fr).toBe('Mouche des fruits');
    expect(list[0].type).toBe(PestType.INSECT);
  });

  it('throws CropNotFoundError / PestNotFoundError', async () => {
    const { crops, pests, controls, audit, pestId } = await setup();
    const uc = new SetCropPestControlUseCase(crops, pests, controls, audit, clock);
    await expect(uc.execute({ cropId: 'nope', pestId, susceptibility: SusceptibilityLevel.LOW, actor: 'a' })).rejects.toThrow(CropNotFoundError);
    await expect(uc.execute({ cropId: 'c1', pestId: 'nope', susceptibility: SusceptibilityLevel.LOW, actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
});
