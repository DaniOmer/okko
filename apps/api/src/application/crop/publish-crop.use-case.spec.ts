import { CreateCropUseCase } from './create-crop.use-case';
import { PublishCropUseCase, CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CycleType } from '../../domain/crop/cycle-type';
import { CropStatus } from '../../domain/crop/crop-status';

const clock = { nowIso: () => '2026-07-02T00:00:00.000Z' };

describe('PublishCropUseCase', () => {
  it('publie une culture existante', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await new CreateCropUseCase(repo, audit, clock).execute({
      id: 'c1',
      commonNames: { fr: 'Carotte' },
      scientificName: 'Daucus carota',
      family: 'Apiaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'a',
    });

    const out = await new PublishCropUseCase(repo, audit, clock).execute({
      id: 'c1',
      actor: 'a',
    });
    expect(out.status).toBe(CropStatus.PUBLISHED);
  });

  it('lève CropNotFoundError si absent', async () => {
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await expect(
      new PublishCropUseCase(repo, audit, clock).execute({
        id: 'x',
        actor: 'a',
      }),
    ).rejects.toThrow(CropNotFoundError);
  });
});
