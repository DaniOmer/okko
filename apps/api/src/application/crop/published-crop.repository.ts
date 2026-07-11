import { CropDocument } from './crop-read-model';

export const PUBLISHED_CROP_REPOSITORY = Symbol('PUBLISHED_CROP_REPOSITORY');

export interface PublishedCropRecord {
  cropId: string;
  revision: number;
  document: CropDocument;
  version: number;
  publishedAt: string;
  publishedBy: string;
  note: string | null;
}

export interface PublishedCropVersion {
  revision: number;
  version: number;
  publishedAt: string;
  publishedBy: string;
  note: string | null;
}

export interface PublishedCropRepository {
  save(record: PublishedCropRecord): Promise<void>;
  findLatest(cropId: string): Promise<PublishedCropRecord | null>;
  findRevision(cropId: string, revision: number): Promise<PublishedCropRecord | null>;
  listByCrop(cropId: string): Promise<PublishedCropVersion[]>;
}
