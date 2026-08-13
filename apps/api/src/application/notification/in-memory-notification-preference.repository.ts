import { NotificationPreferenceRepository } from './notification-preference.repository';
import { NotificationPreferenceSnapshot } from '../../domain/notification/notification-preference';

export class InMemoryNotificationPreferenceRepository implements NotificationPreferenceRepository {
  private store = new Map<string, number>();
  async findByUserId(userId: string): Promise<NotificationPreferenceSnapshot | null> {
    return this.store.has(userId) ? { userId, reminderEveryNDays: this.store.get(userId)! } : null;
  }
  async upsert(userId: string, reminderEveryNDays: number): Promise<void> { this.store.set(userId, reminderEveryNDays); }
}
