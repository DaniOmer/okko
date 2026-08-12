import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPreferenceRepository } from '../../application/notification/notification-preference.repository';
import { NotificationPreferenceSnapshot } from '../../domain/notification/notification-preference';

@Injectable()
export class PrismaNotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findByUserId(userId: string): Promise<NotificationPreferenceSnapshot | null> {
    const r = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    return r ? { userId: r.userId, remindersEnabled: r.remindersEnabled } : null;
  }
  async upsert(userId: string, remindersEnabled: boolean): Promise<void> {
    await this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId, remindersEnabled }, update: { remindersEnabled } });
  }
}
