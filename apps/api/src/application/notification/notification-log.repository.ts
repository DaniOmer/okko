import { NotificationLogSnapshot } from '../../domain/notification/notification-log';

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NOTIFICATION_LOG_REPOSITORY');
export interface NotificationLogRepository {
  lastSentAt(dedupKey: string): Promise<string | null>;
  recordSent(entry: NotificationLogSnapshot): Promise<void>;
}
