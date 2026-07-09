import { CropDocument } from './crop-read-model';

export const PUBLISHED_CROP_REPOSITORY = Symbol('PUBLISHED_CROP_REPOSITORY');

export interface PublishedCropRecord {
  cropId: string;
  document: CropDocument;
  version: number;
  publishedAt: string;
  publishedBy: string;
}

export interface PublishedCropRepository {
  save(record: PublishedCropRecord): Promise<void>;
  findByCrop(cropId: string): Promise<PublishedCropRecord | null>;
}
