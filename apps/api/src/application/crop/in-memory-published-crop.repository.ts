import { PublishedCropRecord, PublishedCropRepository } from './published-crop.repository';

export class InMemoryPublishedCropRepository implements PublishedCropRepository {
  private store = new Map<string, PublishedCropRecord>();
  async save(record: PublishedCropRecord): Promise<void> { this.store.set(record.cropId, record); }
  async findByCrop(cropId: string): Promise<PublishedCropRecord | null> { return this.store.get(cropId) ?? null; }
}
