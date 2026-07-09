import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';

export const CROPPING_WINDOW_REPOSITORY = Symbol('CROPPING_WINDOW_REPOSITORY');

export interface CroppingWindowRepository {
  save(w: CroppingWindowSnapshot): Promise<void>;
  listByCrop(cropId: string): Promise<CroppingWindowSnapshot[]>;
  replaceForCrop(cropId: string, items: CroppingWindowSnapshot[]): Promise<void>;
}
