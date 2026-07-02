import { CropSnapshot } from '../../domain/crop/crop';

export const CROP_REPOSITORY = Symbol('CROP_REPOSITORY');

export interface CropRepository {
  save(snapshot: CropSnapshot): Promise<void>;
  findById(id: string): Promise<CropSnapshot | null>;
  list(): Promise<CropSnapshot[]>;
}
