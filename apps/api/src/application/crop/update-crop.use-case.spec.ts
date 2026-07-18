import { CreateCropUseCase } from './create-crop.use-case';
import { UpdateCropUseCase } from './update-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-02T00:00:00.000Z' };

describe('UpdateCropUseCase', () => {
  it('met à jour commonNames, bumpe la version et audite le diff old→new', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const createAudit = { record: jest.fn() };
    const updateAudit = { record: jest.fn() };

    await new CreateCropUseCase(events, repo, createAudit, clock).execute({
      id: 'u1',
      commonNames: { fr: 'Carotte' },
      scientificName: 'Daucus carota',
      family: 'Apiaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'admin',
    });

    const result = await new UpdateCropUseCase(events, repo, updateAudit, clock).execute({
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

  it('édite l\'identité (scientificName/family/cycleType), bumpe la version et hasUnpublishedChanges', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const createAudit = { record: jest.fn() };
    const updateAudit = { record: jest.fn() };

    await new CreateCropUseCase(events, repo, createAudit, clock).execute({
      id: 'u2',
      commonNames: { fr: 'Maïs' },
      scientificName: 'Zea mays',
      family: 'Gramineae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'admin',
    });

    const result = await new UpdateCropUseCase(events, repo, updateAudit, clock).execute({
      id: 'u2',
      scientificName: 'Zea mays L.',
      family: 'Poaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'admin',
    });

    // (a) snapshot reflects new identity values and bumped version
    expect(result.scientificName).toBe('Zea mays L.');
    expect(result.family).toBe('Poaceae');
    expect(result.cycleType).toBe(CycleType.SEASONAL_ANNUAL);
    expect(result.version).toBe(2);
    expect(result.hasUnpublishedChanges).toBe(true);

    // (b) audit was called with identity diff
    expect(updateAudit.record).toHaveBeenCalledTimes(1);
    const auditCall = updateAudit.record.mock.calls[0][0];
    expect(auditCall.changes).toHaveProperty('identity');
    expect(auditCall.changes.identity.from).toMatchObject({ scientificName: 'Zea mays', family: 'Gramineae' });
    expect(auditCall.changes.identity.to).toMatchObject({ scientificName: 'Zea mays L.', family: 'Poaceae' });
  });

  it('audite un changement d\'identité même si seul usageCategory est fourni (sans scientificName/family/cycleType)', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const createAudit = { record: jest.fn() };
    const updateAudit = { record: jest.fn() };

    await new CreateCropUseCase(events, repo, createAudit, clock).execute({
      id: 'u3',
      commonNames: { fr: 'Tomate' },
      scientificName: 'Solanum lycopersicum',
      family: 'Solanaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'admin',
    });

    const result = await new UpdateCropUseCase(events, repo, updateAudit, clock).execute({
      id: 'u3',
      usageCategory: 'legume-fruit',
      actor: 'admin',
    });

    // usageCategory propagated to snapshot
    expect(result.usageCategory).toBe('legume-fruit');

    // audit must record an identity entry even though scientificName/family/cycleType were not in the input
    expect(updateAudit.record).toHaveBeenCalledTimes(1);
    const auditCall = updateAudit.record.mock.calls[0][0];
    expect(auditCall.changes).toHaveProperty('identity');
    expect(auditCall.changes.identity.to).toMatchObject({ usageCategory: 'legume-fruit' });
  });

  it('préserve usageCategory quand un update partiel ne fournit que scientificName', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const createAudit = { record: jest.fn() };
    const updateAudit = { record: jest.fn() };

    // (a) créer la culture avec usageCategory
    await new CreateCropUseCase(events, repo, createAudit, clock).execute({
      id: 'u4',
      commonNames: { fr: 'Piment' },
      scientificName: 'Capsicum annuum',
      family: 'Solanaceae',
      cycleType: CycleType.SEASONAL_ANNUAL,
      actor: 'admin',
    });

    // first update: set usageCategory
    await new UpdateCropUseCase(events, repo, updateAudit, clock).execute({
      id: 'u4',
      usageCategory: 'legume-fruit',
      actor: 'admin',
    });

    // (b) update partiel : uniquement scientificName, pas de usageCategory dans l'input
    const result = await new UpdateCropUseCase(events, repo, updateAudit, clock).execute({
      id: 'u4',
      scientificName: 'Capsicum annuum L.',
      actor: 'admin',
    });

    // usageCategory doit être préservé (non effacé)
    expect(result.usageCategory).toBe('legume-fruit');
    expect(result.scientificName).toBe('Capsicum annuum L.');
  });
});
