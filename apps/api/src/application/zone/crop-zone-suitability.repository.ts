import { CropZoneSuitabilitySnapshot } from '../../domain/zone/crop-zone-suitability';

export const CROP_ZONE_SUITABILITY_REPOSITORY = Symbol('CROP_ZONE_SUITABILITY_REPOSITORY');

export interface CropZoneSuitabilityRepository {
  save(s: CropZoneSuitabilitySnapshot): Promise<void>;
  listByCrop(cropId: string): Promise<CropZoneSuitabilitySnapshot[]>;
  listByZone(zoneId: string): Promise<CropZoneSuitabilitySnapshot[]>;
  replaceForCrop(cropId: string, items: CropZoneSuitabilitySnapshot[]): Promise<void>;
}
