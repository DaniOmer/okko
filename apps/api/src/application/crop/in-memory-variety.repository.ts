import { VarietyRepository } from './variety.repository';
import { VarietySnapshot } from '../../domain/crop/variety';

export class InMemoryVarietyRepository implements VarietyRepository {
  private store: VarietySnapshot[] = [];
  async save(v: VarietySnapshot): Promise<void> {
    this.store = this.store.filter((x) => x.id !== v.id).concat(v);
  }
  async listByCrop(cropId: string): Promise<VarietySnapshot[]> {
    return this.store.filter((v) => v.cropId === cropId);
  }
  async replaceForCrop(cropId: string, items: VarietySnapshot[]): Promise<void> {
    this.store = this.store.filter((x) => x.cropId !== cropId).concat(items);
  }
}
