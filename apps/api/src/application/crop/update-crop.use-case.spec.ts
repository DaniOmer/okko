import { CreateCropUseCase } from './create-crop.use-case';
import { UpdateCropUseCase } from './update-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-02T00:00:00.000Z' };

describe('UpdateCropUseCase', () => {
  it('met à jour commonNames, bumpe la version et audite le diff old→new', async () => {
    const repo = new InMemoryCropRepository();
    const createAudit = { record: jest.fn() };
    const updateAudit = { record: jest.fn() };

    await new CreateCropUseCase(repo, createAudit, clock).execute({
      id: 'u1',
      commonNames: { fr: 'Carotte' },
      scientificName: 'Daucus carota',
      family: 'Apiaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'admin',
    });

    const result = await new UpdateCropUseCase(repo, updateAudit, clock).execute({
      id: 'u1',
      commonNames: { fr: 'Carotte potagère' },
      actor: 'admin',
    });

    // (a) snapshot reflects new name and bumped version
    expect(result.commonNames.fr).toBe('Carotte potagère');
    expect(result.version).toBe(2);

    // (b) audit was called once with field-level diff for commonNames
    expect(updateAudit.record).toHaveBeenCalledTimes(1);
    const auditCall = updateAudit.record.mock.calls[0][0];
    expect(auditCall.changes).toHaveProperty('commonNames');
    expect(auditCall.changes.commonNames).toHaveProperty('from');
    expect(auditCall.changes.commonNames).toHaveProperty('to');
    // changes payload must NOT contain actor or id
    expect(auditCall.changes).not.toHaveProperty('actor');
    expect(auditCall.changes).not.toHaveProperty('id');
  });
});
