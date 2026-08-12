import { NotificationLogRepository } from './notification-log.repository';
import { NotificationLogSnapshot } from '../../domain/notification/notification-log';

export class InMemoryNotificationLogRepository implements NotificationLogRepository {
  public readonly entries: NotificationLogSnapshot[] = [];
  async existsByDedupKey(dedupKey: string): Promise<boolean> { return this.entries.some((e) => e.dedupKey === dedupKey); }
  async record(entry: NotificationLogSnapshot): Promise<void> { this.entries.push(entry); }
}
