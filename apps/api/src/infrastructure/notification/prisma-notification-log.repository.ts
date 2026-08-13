import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationLogRepository } from '../../application/notification/notification-log.repository';
import { NotificationLogSnapshot } from '../../domain/notification/notification-log';

@Injectable()
export class PrismaNotificationLogRepository implements NotificationLogRepository {
  constructor(private readonly prisma: PrismaService) {}
  async lastSentAt(dedupKey: string): Promise<string | null> {
    const r = await this.prisma.notificationLog.findUnique({ where: { dedupKey } });
    return r ? r.sentAt.toISOString() : null;
  }
  async recordSent(entry: NotificationLogSnapshot): Promise<void> {
    await this.prisma.notificationLog.upsert({
      where: { dedupKey: entry.dedupKey },
      create: { id: entry.id, organizationId: entry.organizationId, dedupKey: entry.dedupKey, kind: entry.kind, sentAt: new Date(entry.sentAt) },
      update: { sentAt: new Date(entry.sentAt) },
    });
  }
}
