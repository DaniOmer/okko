import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationRepository } from '../../application/auth/repositories';
import { Organization, OrgKind } from '../../application/auth/types';

@Injectable()
export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async save(o: Organization): Promise<void> {
    await this.prisma.organization.upsert({ where: { id: o.id }, create: o, update: o });
  }
  async findById(id: string): Promise<Organization | null> {
    const row = await this.prisma.organization.findUnique({ where: { id } });
    if (!row) return null;
    return { ...row, kind: row.kind as OrgKind };
  }
}
