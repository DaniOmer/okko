import { PricePointRepository } from './price-point.repository';
import { PricePointSnapshot } from '../../domain/price/price-point';

export class InMemoryPricePointRepository implements PricePointRepository {
  private store: PricePointSnapshot[] = [];
  async save(p: PricePointSnapshot): Promise<void> {
    this.store = this.store.filter((x) => x.id !== p.id).concat(p);
  }
  async listByCrop(cropId: string): Promise<PricePointSnapshot[]> {
    return this.store
      .filter((p) => p.cropId === cropId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  async replaceForCrop(cropId: string, items: PricePointSnapshot[]): Promise<void> {
    this.store = this.store.filter((x) => x.cropId !== cropId).concat(items);
  }
}
