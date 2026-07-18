import 'server-only';
import { authFetch, publicFetch, jsonInit, ApiError } from './http';
import type { Role } from './jwt';

export { ApiError };

export interface CompletenessReport { categories: Record<string, boolean>; filled: number; total: number; percent: number; }
export interface AuditRecord { id: string; entityType: string; entityId: string; actor: string; at: string; changes: Record<string, unknown>; }

export interface CropDocument {
  id: string; name: string; scientificName: string; family: string;
  cycleType: string; usageCategory?: string; description?: Record<string, string>;
  status: string; version: number;
  publishedVersion: number;
  hasUnpublishedChanges: boolean; hasPublishedVersion: boolean;
  completeness: CompletenessReport;
}

export async function listCrops(): Promise<CropDocument[]> {
  const res = await authFetch('/crops', { cache: 'no-store' });
  return res.json();
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
  const res = await authFetch('/zones', { cache: 'no-store' });
  return res.json();
}

export interface PhenologicalStage { name: Record<string, string>; startDay: number; endDay: number; order: number; description?: string; recommendedWork?: string; }
export interface TechnicalOperation { type: string; label: Record<string, string>; timingDays: number; inputs: string[]; notes?: string; }
export interface CroppingWindow {
  id: string; cropId: string; zoneId: string; season: string;
  sowingStart?: string; sowingEnd?: string; irrigationRequired: boolean;
  operations: TechnicalOperation[]; notes?: string;
}

export interface CropDetail extends CropDocument {
  climatic?: { temperature?: { min: number; optimal: number; max: number; unit: string };
               rainfall?: { min: number; optimal: number; max: number; unit: string };
               altitude?: { min: number; optimal: number; max: number; unit: string };
               waterNeed?: string;
               droughtSensitivity?: string };
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
  const res = await authFetch(`/crops/${id}`, { cache: 'no-store' });
  return res.json();
}

export async function getCropPublished(id: string): Promise<CropDetail> {
  const res = await authFetch(`/crops/${id}/published`, { cache: 'no-store' });
  return res.json();
}

export interface CropVersion {
  revision: number;
  version: number;
  publishedAt: string;
  publishedBy: string;
  note: string | null;
}

export async function getCropVersions(id: string): Promise<CropVersion[]> {
  const res = await authFetch(`/crops/${id}/versions`, { cache: 'no-store' });
  return res.json();
}

export async function getCropVersion(id: string, revision: number): Promise<CropDetail> {
  const res = await authFetch(`/crops/${id}/versions/${revision}`, { cache: 'no-store' });
  return res.json();
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
  const res = await authFetch(`/crops/${id}/diff?from=${from}&to=${to}`, { cache: 'no-store' });
  return res.json();
}

export interface Pest { id: string; name: string; type: string; scientificName?: string; }
export interface CropPest {
  pestId: string; pestName: Record<string, string>; type: string; susceptibility: string;
  threshold?: string; sensitiveStages: string[];
  controlMethods: { category: string; description: Record<string, string>; inputs: string[] }[];
}

export interface NutrientRequirement { nutrient: string; amount: number; unit: string; basis: string; stage?: string; method?: string; }
export interface YieldReference { inputType: string; min: number; average: number; potential: number; unit: string; zoneId?: string; }
export interface PricePoint { id: string; cropId: string; market: string; periodStart: string; periodEnd: string; price: number; unit: string; currency: string; }

export async function listPests(): Promise<Pest[]> {
  const res = await authFetch('/pests', { cache: 'no-store' });
  return res.json();
}

export async function getCropHistory(id: string): Promise<AuditRecord[]> {
  const res = await authFetch(`/crops/${id}/history`, { cache: 'no-store' });
  return res.json();
}

// ————————————————— Auth & invitations —————————————————

export interface AuthResult {
  token: string;
  user: { id: string; email: string; firstName: string; lastName: string; role: Role; organizationId: string | null; createdAt: string };
}
export interface Invitation {
  id: string; organizationId: string; email: string; role: 'editor'; token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string; invitedByUserId: string; createdAt: string; acceptedAt: string | null;
}

export async function apiLogin(email: string, password: string): Promise<AuthResult> {
  const res = await publicFetch('/auth/login', jsonInit('POST', { email, password }));
  return res.json();
}
export interface RegisterResult { status: string; email: string; }
export async function apiRegister(input: { organizationName: string; firstName: string; lastName: string; email: string; password: string }): Promise<RegisterResult> {
  const res = await publicFetch('/auth/register', jsonInit('POST', input));
  return res.json();
}
export interface ConfirmResult { alreadyConfirmed: boolean; email: string; }
export async function apiConfirmEmail(token: string): Promise<ConfirmResult> {
  const res = await publicFetch(`/auth/confirm/${token}`, { method: 'POST' });
  return res.json();
}
export async function apiResendConfirmation(email: string): Promise<void> {
  await publicFetch('/auth/confirm/resend', jsonInit('POST', { email }));
}
export async function apiAcceptInvite(token: string, input: { firstName: string; lastName: string; password: string }): Promise<AuthResult> {
  const res = await publicFetch(`/auth/invitations/${token}/accept`, jsonInit('POST', input));
  return res.json();
}
export interface InvitationInfo { email: string; organizationName: string; acceptable: boolean; }
export async function apiInvitationByToken(token: string): Promise<InvitationInfo> {
  const res = await publicFetch(`/auth/invitations/${token}`, { method: 'GET' });
  return res.json();
}
export async function apiListInvitations(): Promise<Invitation[]> {
  const res = await authFetch('/auth/invitations', { cache: 'no-store' });
  return res.json();
}
export async function apiCreateInvitation(email: string): Promise<{ invitation: Invitation; emailSent: boolean }> {
  const res = await authFetch('/auth/invitations', jsonInit('POST', { email }));
  return res.json();
}
export async function apiRevokeInvitation(id: string): Promise<void> {
  await authFetch(`/auth/invitations/${id}/revoke`, { method: 'POST' });
}
