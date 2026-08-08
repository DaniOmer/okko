'use server';
import { authFetch, jsonInit } from './http';
import type { Beneficiary, Parcel } from './api';

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
