'use server';

import { authFetch, jsonInit } from './http';
import type { CropDocument, Variety, Zone, Pest } from './api';

export async function createCrop(input: {
  commonNames: Record<string, string>; scientificName: string; family: string; cycleType: string;
}): Promise<CropDocument> {
  const res = await authFetch('/crops', jsonInit('POST', input));
  return res.json();
}

export async function updateCrop(id: string, body: { commonNames?: Record<string, string>; scientificName?: string; family?: string; cycleType?: string; usageCategory?: string; description?: Record<string, string> }): Promise<unknown> {
  const res = await authFetch(`/crops/${id}`, jsonInit('PATCH', body));
  return res.json().catch(() => undefined);
}

export async function publishCrop(id: string, note?: string): Promise<void> {
  await authFetch(`/crops/${id}/publish`, jsonInit('POST', { note }));
}

export async function discardDraft(id: string): Promise<void> {
  await authFetch(`/crops/${id}/discard`, { method: 'POST' });
}

export async function archiveCrop(id: string): Promise<unknown> {
  const res = await authFetch(`/crops/${id}/archive`, jsonInit('POST', {}));
  return res.json().catch(() => undefined);
}

export async function unarchiveCrop(id: string): Promise<unknown> {
  const res = await authFetch(`/crops/${id}/unarchive`, jsonInit('POST', {}));
  return res.json().catch(() => undefined);
}

export async function restoreVersion(id: string, revision: number): Promise<void> {
  await authFetch(`/crops/${id}/versions/${revision}/restore`, { method: 'POST' });
}

export async function addVariety(cropId: string, input: { name: Record<string, string>; maturityDays?: number; traits?: string[]; diseaseResistances?: { pestId: string; level: string }[]; zoneAdaptations?: { zoneId: string; rating: string }[] }): Promise<Variety> {
  const res = await authFetch(`/crops/${cropId}/varieties`, jsonInit('POST', input));
  return res.json();
}

export async function updateVariety(cropId: string, varietyId: string, input: { name: Record<string, string>; maturityDays?: number; traits?: string[]; diseaseResistances?: { pestId: string; level: string }[]; zoneAdaptations?: { zoneId: string; rating: string }[] }): Promise<void> {
  await authFetch(`/crops/${cropId}/varieties/${varietyId}`, jsonInit('PUT', input));
}

export async function setRequirements(cropId: string, body: {
  climatic?: { temperature?: { min: number; optimal: number; max: number; unit: string };
               rainfall?: { min: number; optimal: number; max: number; unit: string };
               altitude?: { min: number; optimal: number; max: number; unit: string };
               waterNeed?: string;
               droughtSensitivity?: string };
  edaphic?: { ph?: { min: number; optimal: number; max: number; unit: string }; texture?: string; drainage?: string };
}): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/requirements`, jsonInit('PATCH', body));
  return res.json().catch(() => undefined);
}

export async function setPhenology(cropId: string, stages: { name: Record<string, string>; startDay: number; endDay: number; order: number; description?: string; recommendedWork?: string }[]): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/phenology`, jsonInit('PATCH', { stages }));
  return res.json().catch(() => undefined);
}

export async function setNutrition(cropId: string, requirements: { nutrient: string; amount: number; unit: string; basis: string; stage?: string; method?: string }[]): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/nutrition`, jsonInit('PATCH', { requirements }));
  return res.json().catch(() => undefined);
}

export async function setYields(cropId: string, yieldsList: { inputType: string; min: number; average: number; potential: number; unit: string; zoneId?: string }[]): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/yields`, jsonInit('PATCH', { yields: yieldsList }));
  return res.json().catch(() => undefined);
}

export async function setCommercialization(cropId: string, products: { form: string; saleUnits: string[]; outlets: string[] }[]): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/commercialization`, jsonInit('POST', { commercialization: products }));
  return res.json().catch(() => undefined);
}

export async function addWindow(cropId: string, body: {
  zoneId: string; season: string; sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean;
  operations?: { type: string; label: Record<string, string>; timingDays: number; inputs: string[]; equipment?: string[]; notes?: string }[]; notes?: string;
}): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/windows`, jsonInit('POST', body));
  return res.json().catch(() => undefined);
}

export async function updateWindow(cropId: string, windowId: string, body: {
  zoneId: string; season: string; sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean;
  operations?: { type: string; label: Record<string, string>; timingDays: number; inputs: string[]; equipment?: string[]; notes?: string }[]; notes?: string;
}): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/windows/${windowId}`, jsonInit('PUT', body));
  return res.json().catch(() => undefined);
}

export async function addPrice(cropId: string, body: { form: string; market: string; periodStart: string; periodEnd?: string; price: number; unit: string; currency: string }): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/prices`, jsonInit('POST', body));
  return res.json().catch(() => undefined);
}

export async function updatePrice(cropId: string, priceId: string, body: { form: string; market: string; periodStart: string; periodEnd?: string; price: number; unit: string; currency: string }): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/prices/${priceId}`, jsonInit('PUT', body));
  return res.json().catch(() => undefined);
}

export async function setZoneSuitability(cropId: string, zoneId: string, body: { rating: string; justification?: string }): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/zones/${zoneId}`, jsonInit('PUT', body));
  return res.json().catch(() => undefined);
}

export async function setPestControl(cropId: string, pestId: string, body: {
  susceptibility: string; sensitiveStages?: string[]; threshold?: string;
  controlMethods?: { category: string; description: Record<string, string>; inputs: string[] }[];
}): Promise<unknown> {
  const res = await authFetch(`/crops/${cropId}/pests/${pestId}`, jsonInit('PUT', body));
  return res.json().catch(() => undefined);
}

export async function createZone(input: { name: Record<string, string>; country: string; koppen?: string }): Promise<Zone> {
  const res = await authFetch('/zones', jsonInit('POST', input));
  return res.json();
}

export async function updateZone(id: string, input: { name: Record<string, string>; country: string; koppen?: string }): Promise<Zone> {
  const res = await authFetch(`/zones/${id}`, jsonInit('PATCH', input));
  return res.json();
}

export async function deleteZone(id: string): Promise<void> {
  await authFetch(`/zones/${id}`, { method: 'DELETE' });
}

export async function createPest(input: { name: Record<string, string>; type: string; scientificName?: string }): Promise<Pest> {
  const res = await authFetch('/pests', jsonInit('POST', input));
  return res.json();
}

export async function updatePest(id: string, input: { name: Record<string, string>; type: string; scientificName?: string }): Promise<Pest> {
  const res = await authFetch(`/pests/${id}`, jsonInit('PATCH', input));
  return res.json();
}

export async function deletePest(id: string): Promise<void> {
  await authFetch(`/pests/${id}`, { method: 'DELETE' });
}
