import { CreateCropUseCase } from './create-crop.use-case';
import { GetCropHistoryUseCase } from './get-crop-history.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryAuditLogReader } from '../audit/in-memory-audit-log.reader';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-04T00:00:00.000Z' };

describe('GetCropHistoryUseCase', () => {
  it('returns the crop-level audit records', async () => {
    const crops = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await new CreateCropUseCase(crops, audit, clock).execute({
      id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
      family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
    });
    const reader = new InMemoryAuditLogReader([
      { id: 'r2', entityType: 'Crop', entityId: 'c1', actor: 'a', at: '2026-06-01T00:00:00.000Z', changes: { status: 'PUBLISHED' } },
      { id: 'r1', entityType: 'Crop', entityId: 'c1', actor: 'a', at: '2026-05-01T00:00:00.000Z', changes: { created: true } },
      { id: 'rx', entityType: 'Variety', entityId: 'v1', actor: 'a', at: '2026-06-02T00:00:00.000Z', changes: {} },
    ]);
    const out = await new GetCropHistoryUseCase(crops, reader).execute({ cropId: 'c1' });
    expect(out).toHaveLength(2); // only Crop/c1 entries, Variety excluded
    expect(out[0].id).toBe('r2'); // most recent first
  });

  it('throws CropNotFoundError when the crop is absent', async () => {
    const crops = new InMemoryCropRepository();
    const reader = new InMemoryAuditLogReader([]);
    await expect(new GetCropHistoryUseCase(crops, reader).execute({ cropId: 'nope' }))
      .rejects.toThrow(CropNotFoundError);
  });
});
