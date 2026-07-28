import { Injectable } from '@nestjs/common';
import type { ZonePestPresence as PrismaZPP } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ZonePestPresenceRepository } from '../../application/zone/zone-pest-presence.repository';
import { ZonePestPresenceSnapshot } from '../../domain/zone/zone-pest-presence';

@Injectable()
export class PrismaZonePestPresenceRepository implements ZonePestPresenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(s: ZonePestPresenceSnapshot): Promise<void> {
    await this.prisma.zonePestPresence.upsert({
      where: { zoneId_pestId: { zoneId: s.zoneId, pestId: s.pestId } },
      create: { zoneId: s.zoneId, pestId: s.pestId, frequency: s.frequency },
      update: { frequency: s.frequency },
    });
  }

  async listByZone(zoneId: string): Promise<ZonePestPresenceSnapshot[]> {
    const rows = await this.prisma.zonePestPresence.findMany({ where: { zoneId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async listByPest(pestId: string): Promise<ZonePestPresenceSnapshot[]> {
    const rows = await this.prisma.zonePestPresence.findMany({ where: { pestId } });
    return rows.map((r) => this.toSnapshot(r));
  }

  async delete(zoneId: string, pestId: string): Promise<void> {
    await this.prisma.zonePestPresence.delete({ where: { zoneId_pestId: { zoneId, pestId } } }).catch(() => undefined);
  }

  async deleteByZone(zoneId: string): Promise<void> {
    await this.prisma.zonePestPresence.deleteMany({ where: { zoneId } });
  }

  private toSnapshot(row: PrismaZPP): ZonePestPresenceSnapshot {
    return { zoneId: row.zoneId, pestId: row.pestId, frequency: row.frequency };
  }
}
