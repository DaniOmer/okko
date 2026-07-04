const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface CropDocument {
  id: string; name: string; scientificName: string; family: string;
  cycleType: string; status: string; version: number;
}

export async function listCrops(): Promise<CropDocument[]> {
  const res = await fetch(`${BASE}/crops`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function createCrop(input: {
  commonNames: Record<string, string>; scientificName: string; family: string; cycleType: string;
}): Promise<CropDocument> {
  const res = await fetch(`${BASE}/crops`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function publishCrop(id: string): Promise<void> {
  const res = await fetch(`${BASE}/crops/${id}/publish`, { method: 'POST' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
}

export interface Variety {
  id: string; cropId: string; name: Record<string, string>;
  maturityDays?: number; traits: string[];
}

export interface CropDetail extends CropDocument {
  climatic?: { temperature?: { min: number; optimal: number; max: number; unit: string };
               rainfall?: { min: number; optimal: number; max: number; unit: string } };
  edaphic?: { ph?: { min: number; optimal: number; max: number; unit: string }; texture?: string };
  varieties: Variety[];
}

export async function getCrop(id: string): Promise<CropDetail> {
  const res = await fetch(`${BASE}/crops/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function addVariety(cropId: string, input: { name: Record<string, string>; maturityDays?: number; traits?: string[] }): Promise<Variety> {
  const res = await fetch(`${BASE}/crops/${cropId}/varieties`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
