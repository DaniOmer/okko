'use server';
import { authFetch, jsonInit } from './http';
import type { Beneficiary, Parcel, Campaign, OperationLog, OperationInput } from './api';

export type BeneficiaryPayload = {
  name: string;
  phone?: string;
  notes?: string;
};

export type ParcelPayload = {
  name: string;
  beneficiaryId?: string;
  zoneId?: string;
  gpsLat?: number;
  gpsLng?: number;
  locality?: string;
  areaHectares?: number;
  notes?: string;
};

export async function createBeneficiary(input: BeneficiaryPayload): Promise<Beneficiary> {
  const res = await authFetch('/beneficiaries', jsonInit('POST', input));
  return res.json();
}

export async function updateBeneficiary(id: string, input: BeneficiaryPayload): Promise<Beneficiary> {
  const res = await authFetch(`/beneficiaries/${id}`, jsonInit('PATCH', input));
  return res.json();
}

export async function deleteBeneficiary(id: string): Promise<void> {
  await authFetch(`/beneficiaries/${id}`, { method: 'DELETE' });
}

export async function createParcel(input: ParcelPayload): Promise<Parcel> {
  const res = await authFetch('/parcels', jsonInit('POST', input));
  return res.json();
}

export async function updateParcel(id: string, input: ParcelPayload): Promise<Parcel> {
  const res = await authFetch(`/parcels/${id}`, jsonInit('PATCH', input));
  return res.json();
}

export async function deleteParcel(id: string): Promise<void> {
  await authFetch(`/parcels/${id}`, { method: 'DELETE' });
}

export type CampaignPayload = { parcelId?: string; cropId?: string; customCropName?: string; windowId?: string; varietyId?: string; season?: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string };
export type OperationPayload = { campaignId?: string; type?: string; date?: string; inputs?: OperationInput[]; laborCost?: number; notes?: string; photos?: { key: string; caption?: string }[]; gpsLat?: number; gpsLng?: number };

export async function createCampaign(input: CampaignPayload): Promise<Campaign> {
  const res = await authFetch('/campaigns', jsonInit('POST', input));
  return res.json();
}
export async function updateCampaign(id: string, input: CampaignPayload): Promise<Campaign> {
  const res = await authFetch(`/campaigns/${id}`, jsonInit('PATCH', input));
  return res.json();
}
export async function deleteCampaign(id: string): Promise<void> {
  await authFetch(`/campaigns/${id}`, { method: 'DELETE' });
}
export async function createOperation(input: OperationPayload): Promise<OperationLog> {
  const res = await authFetch('/operations', jsonInit('POST', input));
  return res.json();
}
export async function updateOperation(id: string, input: OperationPayload): Promise<OperationLog> {
  const res = await authFetch(`/operations/${id}`, jsonInit('PATCH', input));
  return res.json();
}
export async function deleteOperation(id: string): Promise<void> {
  await authFetch(`/operations/${id}`, { method: 'DELETE' });
}
export async function notifyCampaignReminder(campaignId: string): Promise<{ sent: number; skipped?: 'already_sent' | 'no_due_items' | 'no_recipients' }> {
  const res = await authFetch(`/campaigns/${campaignId}/notify-reminder`, { method: 'POST' });
  return res.json();
}
export async function getNotificationPreference(): Promise<{ remindersEnabled: boolean }> {
  const res = await authFetch('/me/notification-preferences');
  return res.json();
}
export async function setNotificationPreference(remindersEnabled: boolean): Promise<{ remindersEnabled: boolean }> {
  const res = await authFetch('/me/notification-preferences', jsonInit('PATCH', { remindersEnabled }));
  return res.json();
}
