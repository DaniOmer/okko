import { NotificationLogSnapshot } from '../../domain/notification/notification-log';

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NOTIFICATION_LOG_REPOSITORY');
export interface NotificationLogRepository {
  existsByDedupKey(dedupKey: string): Promise<boolean>;
  record(entry: NotificationLogSnapshot): Promise<void>;
}
