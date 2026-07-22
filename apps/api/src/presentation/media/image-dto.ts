import { MediaImageJSON } from '../../domain/media/media-image';
import { StoragePort } from '../../application/media/storage.port';

export interface ImageDto { key: string; url: string; caption?: string; category?: string; }

export function toImageDto(img: MediaImageJSON, storage: StoragePort): ImageDto {
  return {
    key: img.key,
    url: storage.publicUrl(img.key),
    ...(img.caption ? { caption: img.caption } : {}),
    ...(img.category ? { category: img.category } : {}),
  };
}
