import { CroppingWindowRepository } from './cropping-window.repository';
import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';

export class InMemoryCroppingWindowRepository implements CroppingWindowRepository {
  private store: CroppingWindowSnapshot[] = [];
  async save(w: CroppingWindowSnapshot): Promise<void> {
    this.store = this.store.filter((x) => x.id !== w.id).concat(w);
  }
  async listByCrop(cropId: string): Promise<CroppingWindowSnapshot[]> {
    return this.store.filter((w) => w.cropId === cropId);
  }
  async replaceForCrop(cropId: string, items: CroppingWindowSnapshot[]): Promise<void> {
    this.store = this.store.filter((x) => x.cropId !== cropId).concat(items);
  }
}
