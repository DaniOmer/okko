import { CreateCropUseCase } from './create-crop.use-case';
import { SetCropRequirementsUseCase } from './set-crop-requirements.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-02T00:00:00.000Z' };

async function seed(repo: InMemoryCropRepository, audit: { record: jest.Mock }) {
  await new CreateCropUseCase(repo, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
}

describe('SetCropRequirementsUseCase', () => {
  it('applies climatic + edaphic requirements and audits', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(repo, audit);
    const uc = new SetCropRequirementsUseCase(repo, audit, clock);
    const out = await uc.execute({
      id: 'c1', actor: 'a',
      climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } },
      edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' }, texture: 'limoneux' },
    });
    expect(out.climatic?.temperature?.optimal).toBe(25);
    expect(out.edaphic?.ph?.optimal).toBe(6.5);
    expect(audit.record).toHaveBeenCalled();
  });

  it('throws CropNotFoundError when the crop is absent', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    const uc = new SetCropRequirementsUseCase(repo, audit, clock);
    await expect(uc.execute({ id: 'nope', actor: 'a', climatic: {} })).rejects.toThrow(CropNotFoundError);
  });

  it('partial update: setting only climatic leaves existing edaphic intact, and audit has from/to diff', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(repo, audit);
    const uc = new SetCropRequirementsUseCase(repo, audit, clock);

    // First call: set only edaphic
    await uc.execute({
      id: 'c1', actor: 'a',
      edaphic: { ph: { min: 5.5, optimal: 6.5, max: 7.5, unit: 'pH' }, texture: 'limoneux' },
    });

    // Second call: set only climatic — edaphic must remain from first call
    const out = await uc.execute({
      id: 'c1', actor: 'a',
      climatic: { temperature: { min: 18, optimal: 25, max: 32, unit: '°C' } },
    });

    expect(out.edaphic?.ph?.optimal).toBe(6.5);
    expect(out.climatic?.temperature?.optimal).toBe(25);

    // Audit changes should use from/to diff shape
    const lastCall = audit.record.mock.calls[audit.record.mock.calls.length - 1][0];
    expect(lastCall.changes).toHaveProperty('from');
    expect(lastCall.changes).toHaveProperty('to');
  });
});
