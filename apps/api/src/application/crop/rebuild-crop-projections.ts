import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { CropRepository } from './crop.repository';
import { VarietyRepository } from './variety.repository';
import { CroppingWindowRepository } from '../window/cropping-window.repository';
import { CropZoneSuitabilityRepository } from '../zone/crop-zone-suitability.repository';
import { CropPestControlRepository } from '../pest/crop-pest-control.repository';
import { PricePointRepository } from '../price/price-point.repository';

export interface CropProjectionRepositories {
  crops: CropRepository;
  varieties: VarietyRepository;
  windows: CroppingWindowRepository;
  zones: CropZoneSuitabilityRepository;
  pests: CropPestControlRepository;
  prices: PricePointRepository;
}

export async function rebuildCropProjections(crop: Crop, repos: CropProjectionRepositories): Promise<CropSnapshot> {
  const next = crop.toSnapshot();
  await repos.crops.save(next);
  await repos.varieties.replaceForCrop(crop.id, crop.varieties);
  await repos.windows.replaceForCrop(crop.id, crop.windows);
  await repos.zones.replaceForCrop(crop.id, crop.zones);
  await repos.pests.replaceForCrop(crop.id, crop.pests);
  await repos.prices.replaceForCrop(crop.id, crop.prices);
  return next;
}
