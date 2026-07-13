import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvitationRepository } from '../../application/auth/repositories';
import { Invitation, InvitationStatus } from '../../application/auth/types';

@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async save(inv: Invitation): Promise<void> {
    await this.prisma.invitation.upsert({ where: { id: inv.id }, create: this.toRow(inv), update: this.toRow(inv) });
  }
  async findById(id: string): Promise<Invitation | null> { return this.map(await this.prisma.invitation.findUnique({ where: { id } })); }
  async findByToken(token: string): Promise<Invitation | null> { return this.map(await this.prisma.invitation.findUnique({ where: { token } })); }
  async findPendingByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null> {
    return this.map(await this.prisma.invitation.findFirst({ where: { email, organizationId, status: 'pending' } }));
  }
  async listByOrganization(organizationId: string): Promise<Invitation[]> {
    const rows = await this.prisma.invitation.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.map(r)!);
  }
  private toRow(inv: Invitation) {
    return { id: inv.id, organizationId: inv.organizationId, email: inv.email, role: inv.role, token: inv.token, status: inv.status, expiresAt: inv.expiresAt, invitedByUserId: inv.invitedByUserId, createdAt: inv.createdAt, acceptedAt: inv.acceptedAt };
  }
  private map(r: { id: string; organizationId: string; email: string; role: string; token: string; status: string; expiresAt: Date; invitedByUserId: string; createdAt: Date; acceptedAt: Date | null } | null): Invitation | null {
    return r ? { ...r, role: 'editor', status: r.status as InvitationStatus } : null;
  }
}
