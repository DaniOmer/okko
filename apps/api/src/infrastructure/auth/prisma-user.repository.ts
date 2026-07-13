import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from '../../application/auth/repositories';
import { User, Role } from '../../application/auth/types';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}
  async save(u: User): Promise<void> {
    await this.prisma.user.upsert({ where: { id: u.id }, create: this.toRow(u), update: this.toRow(u) });
  }
  async findById(id: string): Promise<User | null> {
    const r = await this.prisma.user.findUnique({ where: { id } }); return r ? this.toUser(r) : null;
  }
  async findByEmail(email: string): Promise<User | null> {
    const r = await this.prisma.user.findUnique({ where: { email } }); return r ? this.toUser(r) : null;
  }
  async listByOrganization(organizationId: string): Promise<User[]> {
    const rows = await this.prisma.user.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toUser(r));
  }
  private toRow(u: User) { return { id: u.id, email: u.email, name: u.name, role: u.role, organizationId: u.organizationId, createdAt: u.createdAt }; }
  private toUser(r: { id: string; email: string; name: string; role: string; organizationId: string | null; createdAt: Date }): User {
    return { id: r.id, email: r.email, name: r.name, role: r.role as Role, organizationId: r.organizationId, createdAt: r.createdAt };
  }
}
