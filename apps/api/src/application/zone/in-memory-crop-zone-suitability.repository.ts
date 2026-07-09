import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';
import { CropZoneSuitabilitySnapshot } from '../../domain/zone/crop-zone-suitability';

export class InMemoryCropZoneSuitabilityRepository implements CropZoneSuitabilityRepository {
  private store: CropZoneSuitabilitySnapshot[] = [];
  async save(s: CropZoneSuitabilitySnapshot): Promise<void> {
    this.store = this.store.filter((x) => !(x.cropId === s.cropId && x.zoneId === s.zoneId)).concat(s);
  }
  async listByCrop(cropId: string): Promise<CropZoneSuitabilitySnapshot[]> {
    return this.store.filter((s) => s.cropId === cropId);
  }
  async listByZone(zoneId: string): Promise<CropZoneSuitabilitySnapshot[]> {
    return this.store.filter((s) => s.zoneId === zoneId);
  }
  async replaceForCrop(cropId: string, items: CropZoneSuitabilitySnapshot[]): Promise<void> {
    this.store = this.store.filter((x) => x.cropId !== cropId).concat(items);
  }
}
