export type Role = 'superadmin' | 'admin' | 'editor';
export interface User { id: string; email: string; name: string; role: Role; organizationId: string | null; createdAt: Date; }
export interface Organization { id: string; name: string; createdAt: Date; }
export interface AuthIdentity { id: string; userId: string; provider: string; identifier: string; secret: string; createdAt: Date; }
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export interface Invitation {
  id: string; organizationId: string; email: string; role: 'editor'; token: string;
  status: InvitationStatus; expiresAt: Date; invitedByUserId: string; createdAt: Date; acceptedAt: Date | null;
}
export interface AuthTokenPayload { sub: string; email: string; role: Role; organizationId: string | null; }
