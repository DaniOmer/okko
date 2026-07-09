import { CropPestControlRepository } from './crop-pest-control.repository';
import { CropPestControlSnapshot } from '../../domain/pest/crop-pest-control';

export class InMemoryCropPestControlRepository implements CropPestControlRepository {
  private store: CropPestControlSnapshot[] = [];
  async save(c: CropPestControlSnapshot): Promise<void> {
    this.store = this.store.filter((x) => !(x.cropId === c.cropId && x.pestId === c.pestId)).concat(c);
  }
  async listByCrop(cropId: string): Promise<CropPestControlSnapshot[]> {
    return this.store.filter((c) => c.cropId === cropId);
  }
  async listByPest(pestId: string): Promise<CropPestControlSnapshot[]> {
    return this.store.filter((c) => c.pestId === pestId);
  }
  async replaceForCrop(cropId: string, items: CropPestControlSnapshot[]): Promise<void> {
    this.store = this.store.filter((x) => x.cropId !== cropId).concat(items);
  }
}
