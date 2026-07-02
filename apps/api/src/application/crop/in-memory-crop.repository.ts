import { CropRepository } from './crop.repository';
import { CropSnapshot } from '../../domain/crop/crop';

export class InMemoryCropRepository implements CropRepository {
  private store = new Map<string, CropSnapshot>();

  async save(s: CropSnapshot): Promise<void> {
    this.store.set(s.id, s);
  }

  async findById(id: string): Promise<CropSnapshot | null> {
    return this.store.get(id) ?? null;
  }

  async list(): Promise<CropSnapshot[]> {
    return [...this.store.values()];
  }
}
