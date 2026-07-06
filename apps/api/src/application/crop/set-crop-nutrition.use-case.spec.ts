import { CreateCropUseCase } from './create-crop.use-case';
import { SetCropNutritionUseCase } from './set-crop-nutrition.use-case';
import { SetCropYieldsUseCase } from './set-crop-yields.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { CycleType } from '../../domain/crop/cycle-type';
import { NutrientBasis } from '../../domain/crop/nutrient-requirement';
import { InputLevel } from '../../domain/crop/yield-reference';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };

async function seed(events: InMemoryCropEventStore, repo: InMemoryCropRepository, audit: { record: jest.Mock }) {
  await new CreateCropUseCase(events, repo, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
}

describe('SetCropNutrition / SetCropYields', () => {
  it('sets nutrition and audits', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(events, repo, audit);
    const out = await new SetCropNutritionUseCase(repo, audit, clock).execute({
      cropId: 'c1', actor: 'a',
      requirements: [{ nutrient: 'N', amount: 120, unit: 'kg/ha', basis: NutrientBasis.PER_HECTARE }],
    });
    expect(out.nutrition).toHaveLength(1);
    expect(audit.record).toHaveBeenCalled();
  });

  it('sets yields and audits', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(events, repo, audit);
    const out = await new SetCropYieldsUseCase(repo, audit, clock).execute({
      cropId: 'c1', actor: 'a',
      yields: [{ inputLevel: InputLevel.MEDIUM, min: 2, average: 4, potential: 6, unit: 't/ha' }],
    });
    expect(out.yields).toHaveLength(1);
    expect(audit.record).toHaveBeenCalled();
  });

  it('throws CropNotFoundError when absent', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await expect(new SetCropNutritionUseCase(repo, audit, clock).execute({ cropId: 'x', actor: 'a', requirements: [] }))
      .rejects.toThrow(CropNotFoundError);
  });
});
