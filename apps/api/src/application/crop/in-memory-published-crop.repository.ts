import { PublishedCropRecord, PublishedCropRepository, PublishedCropVersion } from './published-crop.repository';

export class InMemoryPublishedCropRepository implements PublishedCropRepository {
  private store: PublishedCropRecord[] = [];

  async save(record: PublishedCropRecord): Promise<void> {
    this.store = this.store.filter((r) => !(r.cropId === record.cropId && r.revision === record.revision)).concat(record);
  }

  async findLatest(cropId: string): Promise<PublishedCropRecord | null> {
    const rows = this.store.filter((r) => r.cropId === cropId);
    if (rows.length === 0) return null;
    return rows.reduce((a, b) => (b.revision > a.revision ? b : a));
  }

  async findRevision(cropId: string, revision: number): Promise<PublishedCropRecord | null> {
    return this.store.find((r) => r.cropId === cropId && r.revision === revision) ?? null;
  }

  async listByCrop(cropId: string): Promise<PublishedCropVersion[]> {
    return this.store
      .filter((r) => r.cropId === cropId)
      .sort((a, b) => b.revision - a.revision)
      .map((r) => ({ revision: r.revision, version: r.version, publishedAt: r.publishedAt, publishedBy: r.publishedBy }));
  }
}
