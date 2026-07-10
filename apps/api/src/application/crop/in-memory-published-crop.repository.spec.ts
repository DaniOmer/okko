import { InMemoryPublishedCropRepository } from './in-memory-published-crop.repository';
import { PublishedCropRecord } from './published-crop.repository';

const rec = (revision: number): PublishedCropRecord => ({
  cropId: 'c1', revision,
  document: { id: 'c1', name: `v${revision}` } as any,
  version: revision, publishedAt: `2026-07-10T0${revision}:00:00.000Z`, publishedBy: 'admin',
});

describe('InMemoryPublishedCropRepository', () => {
  it('findLatest renvoie la révision la plus haute', async () => {
    const repo = new InMemoryPublishedCropRepository();
    await repo.save(rec(1)); await repo.save(rec(2));
    expect((await repo.findLatest('c1'))!.revision).toBe(2);
    expect(await repo.findLatest('absent')).toBeNull();
  });

  it('findRevision renvoie la version demandée avec son document', async () => {
    const repo = new InMemoryPublishedCropRepository();
    await repo.save(rec(1)); await repo.save(rec(2));
    const r1 = await repo.findRevision('c1', 1);
    expect(r1!.document.name).toBe('v1');
    expect(await repo.findRevision('c1', 99)).toBeNull();
  });

  it('listByCrop renvoie les métadonnées triées décroissant, sans document', async () => {
    const repo = new InMemoryPublishedCropRepository();
    await repo.save(rec(1)); await repo.save(rec(2));
    const list = await repo.listByCrop('c1');
    expect(list.map((v) => v.revision)).toEqual([2, 1]);
    expect((list[0] as any).document).toBeUndefined();
    expect(await repo.listByCrop('absent')).toEqual([]);
  });
});
