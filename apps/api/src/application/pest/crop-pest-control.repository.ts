import { CropPestControlSnapshot } from '../../domain/pest/crop-pest-control';

export const CROP_PEST_CONTROL_REPOSITORY = Symbol('CROP_PEST_CONTROL_REPOSITORY');

export interface CropPestControlRepository {
  save(c: CropPestControlSnapshot): Promise<void>;
  listByCrop(cropId: string): Promise<CropPestControlSnapshot[]>;
  listByPest(pestId: string): Promise<CropPestControlSnapshot[]>;
}
