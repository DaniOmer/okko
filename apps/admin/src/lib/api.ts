const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface CropDocument {
  id: string; name: string; scientificName: string; family: string;
  cycleType: string; status: string; version: number;
}

export async function listCrops(): Promise<CropDocument[]> {
  const res = await fetch(`${BASE}/crops`, { cache: 'no-store' });
  return res.json();
}

export async function createCrop(input: {
  commonNames: Record<string, string>; scientificName: string; family: string; cycleType: string;
}): Promise<CropDocument> {
  const res = await fetch(`${BASE}/crops`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return res.json();
}

export async function publishCrop(id: string): Promise<void> {
  await fetch(`${BASE}/crops/${id}/publish`, { method: 'POST' });
}
