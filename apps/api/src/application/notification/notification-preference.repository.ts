import { NotificationPreferenceSnapshot } from '../../domain/notification/notification-preference';

export const NOTIFICATION_PREFERENCE_REPOSITORY = Symbol('NOTIFICATION_PREFERENCE_REPOSITORY');
export interface NotificationPreferenceRepository {
  findByUserId(userId: string): Promise<NotificationPreferenceSnapshot | null>;
  upsert(userId: string, reminderEveryNDays: number): Promise<void>;
}
