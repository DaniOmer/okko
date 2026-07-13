import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthIdentityRepository } from '../../application/auth/repositories';
import { AuthIdentity } from '../../application/auth/types';

@Injectable()
export class PrismaAuthIdentityRepository implements AuthIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}
  async save(i: AuthIdentity): Promise<void> {
    await this.prisma.authIdentity.upsert({ where: { id: i.id }, create: i, update: i });
  }
  async findByProviderIdentifier(provider: string, identifier: string): Promise<AuthIdentity | null> {
    return this.prisma.authIdentity.findUnique({ where: { provider_identifier: { provider, identifier } } });
  }
}
