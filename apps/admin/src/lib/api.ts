const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface CompletenessReport { categories: Record<string, boolean>; filled: number; total: number; percent: number; }
export interface AuditRecord { id: string; entityType: string; entityId: string; actor: string; at: string; changes: Record<string, unknown>; }

export interface CropDocument {
  id: string; name: string; scientificName: string; family: string;
  cycleType: string; status: string; version: number;
  publishedVersion: number;
  hasUnpublishedChanges: boolean; hasPublishedVersion: boolean;
  completeness: CompletenessReport;
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

export async function publishCrop(id: string, note?: string): Promise<void> {
  const res = await fetch(`${BASE}/crops/${id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
}

export interface Variety {
  id: string; cropId: string; name: Record<string, string>;
  maturityDays?: number; traits: string[];
}

export interface Zone {
  id: string; name: string; country: string; koppen?: string;
}
export interface CropZone {
  zoneId: string; zoneName: Record<string, string>; rating: string; justification?: string;
}

export async function listZones(): Promise<Zone[]> {
  const res = await fetch(`${BASE}/zones`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
export async function createZone(input: { name: Record<string, string>; country: string; koppen?: string }): Promise<Zone> {
  const res = await fetch(`${BASE}/zones`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function readError(res: Response): Promise<string> {
  try { const b = await res.json(); return typeof b?.message === 'string' ? b.message : `API ${res.status}`; }
  catch { return `API ${res.status}`; }
}

export async function updateZone(id: string, input: { name: Record<string, string>; country: string; koppen?: string }): Promise<Zone> {
  const res = await fetch(`${BASE}/zones/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteZone(id: string): Promise<void> {
  const res = await fetch(`${BASE}/zones/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res));
}

export interface PhenologicalStage { name: Record<string, string>; startDay: number; endDay: number; order: number; }
export interface TechnicalOperation { type: string; label: Record<string, string>; timingDays: number; inputs: string[]; notes?: string; }
export interface CroppingWindow {
  id: string; cropId: string; zoneId: string; season: string;
  sowingStart?: string; sowingEnd?: string; irrigationRequired: boolean;
  operations: TechnicalOperation[]; notes?: string;
}

export interface CropDetail extends CropDocument {
  climatic?: { temperature?: { min: number; optimal: number; max: number; unit: string };
               rainfall?: { min: number; optimal: number; max: number; unit: string } };
  edaphic?: { ph?: { min: number; optimal: number; max: number; unit: string }; texture?: string };
  varieties: Variety[];
  zones: CropZone[];
  phenology: PhenologicalStage[];
  croppingWindows: CroppingWindow[];
  pests: CropPest[];
  nutrition: NutrientRequirement[];
  yields: YieldReference[];
  prices: PricePoint[];
}

export async function getCrop(id: string): Promise<CropDetail> {
  const res = await fetch(`${BASE}/crops/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function getCropPublished(id: string): Promise<CropDetail> {
  const res = await fetch(`${BASE}/crops/${id}/published`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function discardDraft(id: string): Promise<void> {
  const res = await fetch(`${BASE}/crops/${id}/discard`, { method: 'POST' });
  if (!res.ok) throw new Error(await readError(res));
}

export interface CropVersion {
  revision: number;
  version: number;
  publishedAt: string;
  publishedBy: string;
  note: string | null;
}

export async function getCropVersions(id: string): Promise<CropVersion[]> {
  const res = await fetch(`${BASE}/crops/${id}/versions`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function getCropVersion(id: string, revision: number): Promise<CropDetail> {
  const res = await fetch(`${BASE}/crops/${id}/versions/${revision}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function restoreVersion(id: string, revision: number): Promise<void> {
  const res = await fetch(`${BASE}/crops/${id}/versions/${revision}/restore`, { method: 'POST' });
  if (!res.ok) throw new Error(await readError(res));
}

export interface FieldChange { field: string; before: unknown; after: unknown; }
export interface ItemChange { key: string; before: unknown; after: unknown; fields: FieldChange[]; }
export interface SectionDiff { section: string; added: unknown[]; removed: unknown[]; changed: ItemChange[]; }
export interface CropDiff {
  cropId: string;
  from: number;
  to: number;
  fields: FieldChange[];
  sections: SectionDiff[];
}

export async function getCropDiff(id: string, from: number, to: number): Promise<CropDiff> {
  const res = await fetch(`${BASE}/crops/${id}/diff?from=${from}&to=${to}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function addVariety(cropId: string, input: { name: Record<string, string>; maturityDays?: number; traits?: string[] }): Promise<Variety> {
  const res = await fetch(`${BASE}/crops/${cropId}/varieties`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function updateVariety(cropId: string, varietyId: string, input: { name: Record<string, string>; maturityDays?: number; traits?: string[] }): Promise<void> {
  const res = await fetch(`${BASE}/crops/${cropId}/varieties/${varietyId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
}

export interface Pest { id: string; name: string; type: string; scientificName?: string; }
export interface CropPest {
  pestId: string; pestName: Record<string, string>; type: string; susceptibility: string;
  threshold?: string; sensitiveStages: string[];
  controlMethods: { category: string; description: Record<string, string>; inputs: string[] }[];
}

export interface NutrientRequirement { nutrient: string; amount: number; unit: string; basis: string; stage?: string; }
export interface YieldReference { inputLevel: string; min: number; average: number; potential: number; unit: string; zoneId?: string; }
export interface PricePoint { id: string; cropId: string; market: string; periodStart: string; periodEnd: string; price: number; unit: string; currency: string; }

export async function listPests(): Promise<Pest[]> {
  const res = await fetch(`${BASE}/pests`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
export async function createPest(input: { name: Record<string, string>; type: string; scientificName?: string }): Promise<Pest> {
  const res = await fetch(`${BASE}/pests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function updatePest(id: string, input: { name: Record<string, string>; type: string; scientificName?: string }): Promise<Pest> {
  const res = await fetch(`${BASE}/pests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deletePest(id: string): Promise<void> {
  const res = await fetch(`${BASE}/pests/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res));
}

export async function getCropHistory(id: string): Promise<AuditRecord[]> {
  const res = await fetch(`${BASE}/crops/${id}/history`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function mutate(path: string, method: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json().catch(() => undefined);
}

export function setRequirements(cropId: string, body: {
  climatic?: { temperature?: { min: number; optimal: number; max: number; unit: string };
               rainfall?: { min: number; optimal: number; max: number; unit: string } };
  edaphic?: { ph?: { min: number; optimal: number; max: number; unit: string }; texture?: string; drainage?: string };
}): Promise<unknown> {
  return mutate(`/crops/${cropId}/requirements`, 'PATCH', body);
}

export function setPhenology(cropId: string, stages: { name: Record<string, string>; startDay: number; endDay: number; order: number }[]): Promise<unknown> {
  return mutate(`/crops/${cropId}/phenology`, 'PATCH', { stages });
}

export function setNutrition(cropId: string, requirements: { nutrient: string; amount: number; unit: string; basis: string; stage?: string }[]): Promise<unknown> {
  return mutate(`/crops/${cropId}/nutrition`, 'PATCH', { requirements });
}

export function setYields(cropId: string, yieldsList: { inputLevel: string; min: number; average: number; potential: number; unit: string; zoneId?: string }[]): Promise<unknown> {
  return mutate(`/crops/${cropId}/yields`, 'PATCH', { yields: yieldsList });
}

export function addWindow(cropId: string, body: {
  zoneId: string; season: string; sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean;
  operations?: { type: string; label: Record<string, string>; timingDays: number; inputs: string[]; notes?: string }[]; notes?: string;
}): Promise<unknown> {
  return mutate(`/crops/${cropId}/windows`, 'POST', body);
}

export function addPrice(cropId: string, body: { market: string; periodStart: string; periodEnd?: string; price: number; unit: string; currency: string }): Promise<unknown> {
  return mutate(`/crops/${cropId}/prices`, 'POST', body);
}

export function updatePrice(cropId: string, priceId: string, body: { market: string; periodStart: string; periodEnd?: string; price: number; unit: string; currency: string }): Promise<unknown> {
  return mutate(`/crops/${cropId}/prices/${priceId}`, 'PUT', body);
}

export function setZoneSuitability(cropId: string, zoneId: string, body: { rating: string; justification?: string }): Promise<unknown> {
  return mutate(`/crops/${cropId}/zones/${zoneId}`, 'PUT', body);
}

export function setPestControl(cropId: string, pestId: string, body: {
  susceptibility: string; sensitiveStages?: string[]; threshold?: string;
  controlMethods?: { category: string; description: Record<string, string>; inputs: string[] }[];
}): Promise<unknown> {
  return mutate(`/crops/${cropId}/pests/${pestId}`, 'PUT', body);
}
