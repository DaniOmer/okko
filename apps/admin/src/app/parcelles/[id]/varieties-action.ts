'use server';
import { getCropPublished } from '@/lib/api';
import type { Variety, CroppingWindow } from '@/lib/api';

export async function fetchCropVarieties(cropId: string): Promise<Variety[]> {
  const crop = await getCropPublished(cropId).catch(() => null);
  return crop?.varieties ?? [];
}

export async function fetchCropWindows(cropId: string): Promise<CroppingWindow[]> {
  const crop = await getCropPublished(cropId).catch(() => null);
  return crop?.croppingWindows ?? [];
}
