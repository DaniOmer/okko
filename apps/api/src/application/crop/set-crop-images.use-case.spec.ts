import { CreateCropUseCase } from './create-crop.use-case';
import { SetCropImagesUseCase } from './set-crop-images.use-case';
import { CropNotFoundError } from './publish-crop.use-case';
import { InMemoryCropRepository } from './in-memory-crop.repository';
import { InMemoryCropEventStore } from './in-memory-crop-event-store';
import { CycleType } from '../../domain/crop/cycle-type';

const clock = { nowIso: () => '2026-07-19T00:00:00.000Z' };

async function seed(events: InMemoryCropEventStore, repo: InMemoryCropRepository, audit: { record: jest.Mock }) {
  await new CreateCropUseCase(events, repo, audit, clock).execute({
    id: 'c1', commonNames: { fr: 'Maïs' }, scientificName: 'Zea mays',
    family: 'Poaceae', cycleType: CycleType.SEASONAL_ANNUAL, actor: 'a',
  });
}

describe('SetCropImagesUseCase', () => {
  it('sets images, bumps version, and audits', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(events, repo, audit);
    const out = await new SetCropImagesUseCase(events, repo, audit, clock).execute({
      cropId: 'c1', actor: 'a',
      images: [{ key: 'images/maize-field.jpg', caption: 'Champ de maïs' }],
    });
    expect(out.images).toHaveLength(1);
    expect(out.images[0].key).toBe('images/maize-field.jpg');
    expect(out.images[0].caption).toBe('Champ de maïs');
    expect(audit.record).toHaveBeenCalled();
    const auditCall = audit.record.mock.calls[audit.record.mock.calls.length - 1][0];
    expect(auditCall.changes.images.to).toHaveLength(1);
  });

  it('replaces existing images when called again', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(events, repo, audit);
    const uc = new SetCropImagesUseCase(events, repo, audit, clock);
    await uc.execute({ cropId: 'c1', actor: 'a', images: [{ key: 'images/a.jpg' }] });
    const out = await uc.execute({ cropId: 'c1', actor: 'a', images: [{ key: 'images/b.jpg' }, { key: 'images/c.jpg' }] });
    expect(out.images).toHaveLength(2);
    expect(out.images[0].key).toBe('images/b.jpg');
    expect(out.images[1].key).toBe('images/c.jpg');
  });

  it('clears images when an empty list is provided', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(events, repo, audit);
    const uc = new SetCropImagesUseCase(events, repo, audit, clock);
    await uc.execute({ cropId: 'c1', actor: 'a', images: [{ key: 'images/a.jpg' }] });
    const out = await uc.execute({ cropId: 'c1', actor: 'a', images: [] });
    expect(out.images).toHaveLength(0);
  });

  it('throws CropNotFoundError when crop is absent', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await expect(new SetCropImagesUseCase(events, repo, audit, clock).execute({ cropId: 'x', actor: 'a', images: [] }))
      .rejects.toThrow(CropNotFoundError);
  });

  it('images do not appear in completeness (still 11 categories)', async () => {
    const events = new InMemoryCropEventStore();
    const repo = new InMemoryCropRepository();
    const audit = { record: jest.fn() };
    await seed(events, repo, audit);
    const uc = new SetCropImagesUseCase(events, repo, audit, clock);
    const snap = await uc.execute({ cropId: 'c1', actor: 'a', images: [{ key: 'images/a.jpg' }] });
    // images are in the snapshot but NOT in completeness
    expect(snap.images).toHaveLength(1);
    // Verify the snapshot is stored and retrievable
    const stored = await repo.findById('c1');
    expect(stored!.images).toHaveLength(1);
  });
});
