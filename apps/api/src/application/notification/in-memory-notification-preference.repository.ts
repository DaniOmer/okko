import { NotificationPreferenceRepository } from './notification-preference.repository';
import { NotificationPreferenceSnapshot } from '../../domain/notification/notification-preference';

export class InMemoryNotificationPreferenceRepository implements NotificationPreferenceRepository {
  private store = new Map<string, boolean>();
  async findByUserId(userId: string): Promise<NotificationPreferenceSnapshot | null> {
    return this.store.has(userId) ? { userId, remindersEnabled: this.store.get(userId)! } : null;
  }
  async upsert(userId: string, remindersEnabled: boolean): Promise<void> { this.store.set(userId, remindersEnabled); }
}
